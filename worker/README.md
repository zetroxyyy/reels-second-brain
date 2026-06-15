# Reels Second Brain — VPS Worker

The background processing daemon that transforms raw Instagram Reel URLs into rich, searchable knowledge.

## Pipeline

```
Supabase (queue) → yt-dlp (audio) → Whisper (transcript) → Ollama llama3 (summary + entities) → Ollama nomic-embed-text (vector) → Supabase (update)
```

Each cycle picks **one** unprocessed reel, runs it through the full pipeline, writes results back to the database, and moves to the next.

---

## Prerequisites (Ubuntu VPS, 8 GB RAM)

### 1. System packages

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv ffmpeg git
```

> `ffmpeg` is required by yt-dlp for MP3 post-processing and by Whisper for audio decoding.

### 2. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Pull the two models used by the worker:

```bash
ollama pull llama3            # ~4.7 GB — summarisation + entity extraction
ollama pull nomic-embed-text  # ~274 MB — 768-dim semantic embeddings
```

---

## Setup

```bash
# 1. Enter the worker directory
cd worker/

# 2. Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env
nano .env          # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

---

## Running the Worker

### Development (foreground)

```bash
source venv/bin/activate
python main.py
```

You will see structured log output like:

```
2026-06-14 11:00:00  [INFO    ]  Queue is empty. Sleeping for 10 seconds…
2026-06-14 11:00:10  [INFO    ]  ════════════════════════════════════════════
2026-06-14 11:00:10  [INFO    ]  Processing reel: https://www.instagram.com/reel/ABC123
2026-06-14 11:00:10  [INFO    ]    [DOWNLOAD] Fetching audio from: …
2026-06-14 11:00:18  [INFO    ]    [DOWNLOAD] Saved to: /tmp/reels_worker/<id>.mp3 (4123 KB)
2026-06-14 11:00:18  [INFO    ]    [WHISPER] Transcribing: <id>.mp3
2026-06-14 11:00:45  [INFO    ]    [WHISPER] Transcribed 312 words.
2026-06-14 11:00:45  [INFO    ]    [OLLAMA] Requesting summary from llama3 model…
2026-06-14 11:01:12  [INFO    ]    [OLLAMA] Summary generated. Topic: 'cooking', Tags: ['recipe', 'pasta']
2026-06-14 11:01:12  [INFO    ]    [EMBED] Generating embedding with nomic-embed-text…
2026-06-14 11:01:13  [INFO    ]    [EMBED] Vector dimensions: 768
2026-06-14 11:01:13  [INFO    ]    [DB] Writing results to Supabase…
2026-06-14 11:01:13  [INFO    ]    [DB] ✓ Reel <id> updated successfully.
2026-06-14 11:01:13  [INFO    ]    [CLEANUP] Deleted: <id>.mp3
2026-06-14 11:01:13  [INFO    ]  ✓ Reel processed successfully.
```

### Production (systemd service)

Create a systemd unit file so the worker auto-starts on reboot and restarts on crashes:

```bash
sudo nano /etc/systemd/system/reels-worker.service
```

Paste:

```ini
[Unit]
Description=Reels Second Brain — Background Processing Worker
After=network.target ollama.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/reels-second-brain/worker
ExecStart=/home/ubuntu/reels-second-brain/worker/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable reels-worker
sudo systemctl start reels-worker
```

Check live logs:

```bash
sudo journalctl -u reels-worker -f
```

---

## Error Handling

| Failure mode | Behaviour |
|---|---|
| Instagram blocks download | Sets `ai_summary = '[FAILED] Download failed: …'`, moves on |
| Whisper crashes | Sets `ai_summary = '[FAILED] Transcription failed: …'`, moves on |
| Ollama unreachable | Stores raw transcript; sets `ai_summary = '[FAILED] Ollama error'` |
| Embedding fails | Stores summary without vector; search won't work for this reel |
| Unexpected exception | Logs the full traceback, sleeps 10 s, retries |

Failed reels can be re-queued by setting their `ai_summary` back to `NULL` in Supabase.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SUPABASE_URL` | *(required)* | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | *(required)* | Service-role key (bypasses RLS) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server base URL |
| `WHISPER_MODEL` | `base` | Whisper model size (`tiny`/`base`/`small`/`medium`) |
| `CYCLE_SLEEP_SECONDS` | `10` | Seconds to wait when the queue is empty |
| `TEMP_DIR` | `/tmp/reels_worker` | Scratch directory for temporary MP3 files |
