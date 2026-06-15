"""
=============================================================================
Reels Second Brain — VPS Background Processing Worker
=============================================================================

Architecture Overview
─────────────────────
This script runs as a long-lived daemon on an Ubuntu VPS. It polls the
Supabase `reels` table in a continuous loop and processes one reel per
cycle through the following pipeline:

  1. QUERY    — Fetch one un-processed reel (ai_summary IS NULL)
  2. DOWNLOAD — Extract the audio track as an .mp3 with yt-dlp
  3. TRANSCRIBE — Convert speech → text with OpenAI Whisper (base model)
  4. SUMMARIZE — Send transcript to Ollama (llama3) for summary + entities
  5. EMBED    — Generate a 768-dim vector with Ollama (nomic-embed-text)
  6. UPDATE   — Write all results back to Supabase
  7. CLEANUP  — Delete the temporary .mp3 from disk

Hardware target: Ubuntu VPS with 8 GB RAM.
Whisper base model uses ~1 GB VRAM/RAM; Ollama llama3 uses ~4–5 GB RAM.

Usage
─────
  cd worker/
  python -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  cp .env.example .env          # fill in your Supabase credentials
  python main.py

Environment variables (see .env.example)
─────────────────────────────────────────
  SUPABASE_URL              — e.g. https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY — service-role key (bypasses RLS)
  OLLAMA_BASE_URL           — defaults to http://localhost:11434
  CYCLE_SLEEP_SECONDS       — seconds to wait between cycles (default 10)
  WHISPER_MODEL             — Whisper model size (default: base)
  TEMP_DIR                  — directory for temporary audio files (default: /tmp/reels_worker)

=============================================================================
"""

# ── Standard library ──────────────────────────────────────────────────────────
import json
import logging
import os
import time
from pathlib import Path

# ── Third-party ───────────────────────────────────────────────────────────────
import requests
import whisper
import yt_dlp
from dotenv import load_dotenv
from supabase import create_client, Client

# =============================================================================
# 0.  CONFIGURATION & LOGGING
# =============================================================================

# Load .env before anything else so os.getenv() picks up the values.
load_dotenv()

# ── Logging setup ─────────────────────────────────────────────────────────────
# We use a consistent format so every log line is easy to grep / tail -f.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)-8s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("reels_worker")

# ── Runtime constants (overridable via environment) ───────────────────────────
SUPABASE_URL: str              = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
OLLAMA_BASE_URL: str           = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
CYCLE_SLEEP_SECONDS: int       = int(os.getenv("CYCLE_SLEEP_SECONDS", "10"))
WHISPER_MODEL_NAME: str        = os.getenv("WHISPER_MODEL", "base")
TEMP_DIR: Path                 = Path(os.getenv("TEMP_DIR", "/tmp/reels_worker"))

# Ollama model names
OLLAMA_SUMMARIZE_MODEL: str = "llama3"
OLLAMA_EMBED_MODEL: str     = "nomic-embed-text"

# Whisper base model is loaded once at startup to avoid reloading it every cycle.
# This saves ~2–3 seconds per reel and avoids repeated disk I/O.
_whisper_model = None   # lazy-loaded in transcribe_audio()


# =============================================================================
# 1.  SUPABASE CLIENT
# =============================================================================

def build_supabase_client() -> Client:
    """
    Create and return a Supabase Python client authenticated with the
    service-role key so it can bypass Row Level Security (RLS).

    Raises:
        RuntimeError: if the required environment variables are missing.
    """
    if not SUPABASE_URL:
        raise RuntimeError(
            "SUPABASE_URL is not set. "
            "Add it to worker/.env  (e.g. https://<project>.supabase.co)"
        )
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Find it in Supabase Dashboard → Project Settings → API → service_role."
        )

    log.info("Connecting to Supabase: %s", SUPABASE_URL)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# =============================================================================
# 2.  PIPELINE STEPS
# =============================================================================

# ── Step 2a: Fetch one unprocessed reel ──────────────────────────────────────

def fetch_next_reel(supabase: Client) -> dict | None:
    """
    Query the `reels` table for a single record that has not yet been
    processed (ai_summary IS NULL) and return it as a plain dict.

    We order by created_at ASC so we always process the oldest reel first
    (FIFO queue), ensuring no record is skipped indefinitely.

    Returns:
        A dict with the reel row data, or None if the queue is empty.
    """
    response = (
        supabase.table("reels")
        .select("id, original_url, ai_summary")
        .is_("ai_summary", "null")          # ai_summary IS NULL → not yet processed
        .order("created_at", desc=False)    # oldest first
        .limit(1)
        .execute()
    )

    rows = response.data
    if not rows:
        return None     # queue is empty — the caller will sleep and retry

    return rows[0]      # return the first (and only) row as a dict


# ── Step 2b: Download audio ───────────────────────────────────────────────────

def download_audio(reel_url: str, reel_id: str) -> Path:
    """
    Use yt-dlp to download the audio track of an Instagram Reel as an .mp3
    file saved to TEMP_DIR.

    We request the best available audio stream and post-process it with ffmpeg
    to produce a clean 128 kbps MP3. Whisper doesn't need high bitrate audio.

    Args:
        reel_url: Canonical Instagram Reel URL.
        reel_id:  UUID of the reel (used to name the output file uniquely).

    Returns:
        Path to the downloaded .mp3 file.

    Raises:
        RuntimeError: if yt-dlp fails for any reason (network, geo-block, etc.).
    """
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    output_path = TEMP_DIR / f"{reel_id}.mp3"

    ydl_opts = {
        # Download best audio-only stream.
        "format": "bestaudio/best",
        # Convert to MP3 at 128 kbps — small and sufficient for Whisper.
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        # Output template — yt-dlp appends the extension after post-processing.
        "outtmpl": str(TEMP_DIR / reel_id),
        # Suppress the interactive progress bar to keep logs clean.
        "quiet": True,
        "no_warnings": True,
        # Instagram sometimes requires cookies; set a realistic browser UA.
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        },
    }

    log.info("  [DOWNLOAD] Fetching audio from: %s", reel_url)
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([reel_url])

    if not output_path.exists():
        raise RuntimeError(
            f"yt-dlp finished but the expected output file was not found: {output_path}"
        )

    log.info("  [DOWNLOAD] Saved to: %s  (%d KB)", output_path, output_path.stat().st_size // 1024)
    return output_path


# ── Step 2c: Transcribe with Whisper ─────────────────────────────────────────

def transcribe_audio(audio_path: Path) -> str:
    """
    Run OpenAI Whisper locally on the downloaded MP3 to produce a full
    speech-to-text transcript.

    The model is loaded once (globally) to avoid the ~2 second reload penalty
    on every cycle. The 'base' model uses ~1 GB RAM and is accurate enough for
    most spoken English/Instagram content.

    Args:
        audio_path: Path to the local .mp3 file.

    Returns:
        The full transcript as a single string, or an empty string if
        Whisper produces no output (e.g. silent audio, music-only reel).
    """
    global _whisper_model

    # Lazy-load: only download and initialise the model on the very first call.
    if _whisper_model is None:
        log.info("  [WHISPER] Loading '%s' model (first run — may take a moment)…", WHISPER_MODEL_NAME)
        _whisper_model = whisper.load_model(WHISPER_MODEL_NAME)
        log.info("  [WHISPER] Model loaded.")

    log.info("  [WHISPER] Transcribing: %s", audio_path.name)

    # fp16=False forces CPU-safe float32 arithmetic. On GPU servers you can
    # set fp16=True for a significant speedup.
    result = _whisper_model.transcribe(str(audio_path), fp16=False)

    transcript: str = result.get("text", "").strip()
    word_count = len(transcript.split())
    log.info("  [WHISPER] Transcribed %d words.", word_count)

    return transcript


# ── Step 2d: Summarise + extract entities via Ollama (llama3) ─────────────────

def summarize_with_ollama(transcript: str) -> tuple[str, dict]:
    """
    Send the transcript to a locally running Ollama instance and ask llama3
    to produce:
      - A concise but rich plain-text summary of the reel's content.
      - A structured JSON object of extracted key entities.

    We request raw JSON output via a carefully crafted system prompt so the
    response can be parsed deterministically.

    Args:
        transcript: Full Whisper transcript string.

    Returns:
        A (ai_summary, entities) tuple where:
          - ai_summary is a plain-text string.
          - entities   is a dict matching the database schema
            e.g. {"tags": ["recipe"], "ingredients": ["flour"], "topic": "cooking"}

    Raises:
        RuntimeError: if Ollama is unreachable or returns an unexpected response.
    """
    # ── Build the prompt ─────────────────────────────────────────────────────
    # We use a JSON envelope so the model returns parseable output every time.
    system_prompt = (
        "You are a structured data extraction assistant. "
        "Given a transcript of an Instagram Reel, you must respond with ONLY "
        "valid JSON and nothing else — no markdown, no code fences, no prose. "
        "The JSON must have exactly these keys:\n"
        "  summary    — string: a rich, concise 2-4 sentence summary of the reel content.\n"
        "  tags       — array of strings: up to 8 topic/keyword tags.\n"
        "  topic      — string: the single primary subject (e.g. 'cooking', 'travel', 'tech').\n"
        "  ingredients — array of strings: food ingredients mentioned (empty array if none).\n"
        "  people     — array of strings: named people or creators mentioned (empty array if none).\n"
        "  language   — string: detected spoken language (e.g. 'English').\n"
        "Return ONLY the JSON object."
    )

    user_message = (
        f"Here is the transcript of an Instagram Reel:\n\n"
        f"---\n{transcript}\n---\n\n"
        f"Extract the summary and entities as instructed."
    )

    # ── If the transcript is empty (music-only reel), skip Ollama ────────────
    if not transcript:
        log.warning("  [OLLAMA] Transcript is empty — skipping summarisation.")
        return "No spoken content detected in this reel.", {}

    # ── Call Ollama /api/generate ─────────────────────────────────────────────
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model":  OLLAMA_SUMMARIZE_MODEL,
        "prompt": f"System: {system_prompt}\n\nUser: {user_message}",
        "stream": False,    # collect the entire response before returning
    }

    log.info("  [OLLAMA] Requesting summary from %s model…", OLLAMA_SUMMARIZE_MODEL)
    response = requests.post(url, json=payload, timeout=120)
    response.raise_for_status()

    raw_text: str = response.json().get("response", "").strip()
    log.info("  [OLLAMA] Raw response length: %d chars", len(raw_text))

    # ── Parse JSON from Ollama's response ─────────────────────────────────────
    # The model is instructed to return pure JSON, but it occasionally wraps the
    # output in a markdown code fence. We strip that defensively.
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        # Remove first (``` or ```json) and last (```) lines.
        raw_text = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        ).strip()

    try:
        parsed: dict = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        log.error("  [OLLAMA] Failed to parse JSON from model response: %s", exc)
        log.debug("  [OLLAMA] Raw response was: %s", raw_text[:500])
        # Degrade gracefully: store the raw text as the summary with no entities.
        return raw_text[:2000], {}

    # Extract the summary string and the entities sub-dict.
    ai_summary: str = parsed.get("summary", "").strip()
    entities: dict = {
        "tags":        parsed.get("tags", []),
        "topic":       parsed.get("topic", ""),
        "ingredients": parsed.get("ingredients", []),
        "people":      parsed.get("people", []),
        "language":    parsed.get("language", ""),
    }

    log.info(
        "  [OLLAMA] Summary generated. Topic: '%s', Tags: %s",
        entities.get("topic", "?"),
        entities.get("tags", [])[:3],
    )
    return ai_summary, entities


# ── Step 2e: Generate embedding vector via Ollama (nomic-embed-text) ──────────

def embed_with_ollama(text: str) -> list[float]:
    """
    Send the AI-generated summary to Ollama's /api/embeddings endpoint to
    produce a 768-dimensional semantic vector.

    We embed the summary (not the raw transcript) because:
      - It is shorter → faster embedding.
      - It is cleaner → better semantic representation.
      - 768 dims matches our Supabase vector(768) column exactly.

    Args:
        text: The ai_summary string to embed.

    Returns:
        A list of 768 floats representing the semantic embedding.

    Raises:
        RuntimeError: if Ollama is unreachable or returns no embedding.
    """
    if not text:
        log.warning("  [EMBED] No text to embed — returning empty vector.")
        return []

    url = f"{OLLAMA_BASE_URL}/api/embeddings"
    payload = {
        "model":  OLLAMA_EMBED_MODEL,
        "prompt": text,
    }

    log.info("  [EMBED] Generating embedding with %s…", OLLAMA_EMBED_MODEL)
    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()

    embedding: list[float] = response.json().get("embedding", [])
    log.info("  [EMBED] Vector dimensions: %d", len(embedding))

    if not embedding:
        raise RuntimeError("Ollama returned an empty embedding array.")

    return embedding


# ── Step 2f: Write results back to Supabase ───────────────────────────────────

def update_reel_in_db(
    supabase: Client,
    reel_id: str,
    transcript: str,
    ai_summary: str,
    entities: dict,
    embedding: list[float],
) -> None:
    """
    Update the `reels` row with all processing results in a single PATCH call.

    Args:
        supabase:   Authenticated Supabase client.
        reel_id:    UUID primary key of the reel to update.
        transcript: Full Whisper transcript string.
        ai_summary: Concise Ollama-generated summary.
        entities:   Structured JSONB payload (tags, topic, etc.).
        embedding:  768-dim float vector from nomic-embed-text.
    """
    log.info("  [DB] Writing results to Supabase (reel id: %s)…", reel_id)

    payload: dict = {
        "transcript": transcript,
        "ai_summary": ai_summary,
        "entities":   entities,
    }

    # Only include the embedding if one was generated.
    # Supabase's pgvector column accepts a plain Python list of floats.
    if embedding:
        payload["embedding"] = embedding

    supabase.table("reels").update(payload).eq("id", reel_id).execute()
    log.info("  [DB] ✓ Reel %s updated successfully.", reel_id)


def mark_reel_as_failed(supabase: Client, reel_id: str, reason: str) -> None:
    """
    Mark a reel as permanently failed so the worker doesn't retry it
    endlessly (which would stall the queue).

    We set ai_summary to a sentinel string starting with '[FAILED]'.
    The dashboard can filter these out or display them separately.

    Args:
        supabase:  Authenticated Supabase client.
        reel_id:   UUID of the reel to mark.
        reason:    Short human-readable description of why it failed.
    """
    sentinel = f"[FAILED] {reason[:200]}"   # cap length to avoid oversized strings
    log.warning("  [DB] Marking reel %s as failed: %s", reel_id, reason)
    supabase.table("reels").update({"ai_summary": sentinel}).eq("id", reel_id).execute()


# ── Step 2g: Cleanup ──────────────────────────────────────────────────────────

def cleanup_audio_file(audio_path: Path) -> None:
    """
    Delete the temporary MP3 file from disk.

    On an 8 GB VPS, leaving undeleted files can fill the disk quickly
    (Instagram reels are typically 5–30 MB each as MP3). This step is
    always called — even after failures — to prevent runaway disk usage.

    Args:
        audio_path: Path object pointing to the file to delete.
    """
    try:
        if audio_path and audio_path.exists():
            audio_path.unlink()
            log.info("  [CLEANUP] Deleted: %s", audio_path.name)
        else:
            log.debug("  [CLEANUP] File already gone or path is None — skipping.")
    except OSError as exc:
        # Non-fatal — log and continue. The OS will eventually reclaim the space.
        log.warning("  [CLEANUP] Could not delete %s: %s", audio_path, exc)


# =============================================================================
# 3.  MAIN LOOP
# =============================================================================

def process_one_reel(supabase: Client) -> bool:
    """
    Execute the full processing pipeline for a single reel.

    This function is deliberately isolated so the main while-loop can catch
    top-level exceptions without crashing the entire worker process.

    Returns:
        True  — a reel was found and processed (success or marked-as-failed).
        False — the queue was empty; the caller should sleep and retry.
    """
    # ── 1. Fetch next queued reel ─────────────────────────────────────────────
    reel = fetch_next_reel(supabase)
    if reel is None:
        log.info("Queue is empty. Sleeping for %d seconds…", CYCLE_SLEEP_SECONDS)
        return False    # signal: nothing to do

    reel_id:  str = reel["id"]
    reel_url: str = reel["original_url"]
    log.info("═" * 60)
    log.info("Processing reel: %s", reel_url)
    log.info("  ID: %s", reel_id)

    audio_path: Path | None = None

    try:
        # ── 2. Download audio ─────────────────────────────────────────────────
        try:
            audio_path = download_audio(reel_url, reel_id)
        except Exception as exc:
            # Instagram blocks, geo-restrictions, private reels, etc.
            log.error("  [DOWNLOAD] Failed: %s", exc)
            mark_reel_as_failed(supabase, reel_id, f"Download failed: {exc}")
            return True     # we processed it (even if the outcome was failure)

        # ── 3. Transcribe ─────────────────────────────────────────────────────
        try:
            transcript = transcribe_audio(audio_path)
        except Exception as exc:
            log.error("  [WHISPER] Transcription failed: %s", exc)
            mark_reel_as_failed(supabase, reel_id, f"Transcription failed: {exc}")
            return True

        # ── 4. Summarise + extract entities ───────────────────────────────────
        try:
            ai_summary, entities = summarize_with_ollama(transcript)
        except Exception as exc:
            log.error("  [OLLAMA] Summarisation failed: %s", exc)
            # Don't give up — store the raw transcript without a summary.
            ai_summary = "[FAILED] Ollama summarisation error. Raw transcript saved."
            entities   = {}

        # ── 5. Generate embedding ─────────────────────────────────────────────
        try:
            embedding = embed_with_ollama(ai_summary)
        except Exception as exc:
            log.error("  [EMBED] Embedding failed: %s", exc)
            # Non-fatal — store an empty vector; search won't work for this reel.
            embedding = []

        # ── 6. Update database ────────────────────────────────────────────────
        update_reel_in_db(supabase, reel_id, transcript, ai_summary, entities, embedding)

    finally:
        # ── 7. Always clean up temp file ──────────────────────────────────────
        # The finally block guarantees cleanup even if an unexpected exception
        # bubbles up from any step above.
        cleanup_audio_file(audio_path)

    log.info("✓ Reel processed successfully: %s", reel_id)
    return True     # a reel was processed


def main() -> None:
    """
    Entry point — runs the infinite processing loop.

    The loop:
      - Fetches and fully processes one reel per iteration.
      - If the queue is empty, sleeps for CYCLE_SLEEP_SECONDS before retrying.
      - On unexpected top-level errors, logs them and continues rather than crashing.
        (A crash would require manual restart on the VPS.)
    """
    log.info("╔══════════════════════════════════════════════════════╗")
    log.info("║      Reels Second Brain — VPS Worker Starting       ║")
    log.info("╚══════════════════════════════════════════════════════╝")
    log.info("Configuration:")
    log.info("  Supabase URL      : %s", SUPABASE_URL or "[NOT SET]")
    log.info("  Ollama URL        : %s", OLLAMA_BASE_URL)
    log.info("  Whisper model     : %s", WHISPER_MODEL_NAME)
    log.info("  Temp directory    : %s", TEMP_DIR)
    log.info("  Cycle sleep       : %d seconds", CYCLE_SLEEP_SECONDS)

    # Build the Supabase client once — it is thread-safe and reusable.
    supabase = build_supabase_client()
    log.info("Supabase client ready. Entering main loop…\n")

    while True:
        try:
            found_work = process_one_reel(supabase)

            # Only sleep when the queue is empty so the worker drains quickly
            # when many reels are waiting.
            if not found_work:
                time.sleep(CYCLE_SLEEP_SECONDS)

        except KeyboardInterrupt:
            # Graceful shutdown on Ctrl-C or SIGINT.
            log.info("\nReceived keyboard interrupt. Shutting down cleanly.")
            break

        except Exception as exc:
            # Catch-all for truly unexpected errors (network blip, Supabase
            # timeout, etc.). Log it and keep going — do NOT crash the daemon.
            log.exception("Unexpected error in main loop (will retry in %d s): %s", CYCLE_SLEEP_SECONDS, exc)
            time.sleep(CYCLE_SLEEP_SECONDS)


# =============================================================================
# 4.  SCRIPT ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    main()
