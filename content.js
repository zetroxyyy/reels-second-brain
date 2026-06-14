/**
 * Reels Second Brain — content.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs on every Instagram page at document_idle.
 * Only activates the HUD when the URL is a Saved-Reels page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────
  const HUD_ID              = 'rsb-hud';
  const POLL_INTERVAL_MS    = 200;   // How often we check for new reels during a scroll pass
  const STALL_TIMEOUT_MS    = 5000;  // No new reels for this long → assume end reached
  const SCROLL_PAUSE_MS     = 600;   // Brief pause before we start polling after a scroll
  const PAGE_PATTERN        = /instagram\.com\/[^/]+\/saved(\/all-posts)?\/?/;

  // ── State ────────────────────────────────────────────────────────────────────
  let reelSet        = new Set();   // Accumulates every unique reel URL seen so far
  let syncing        = false;
  let stopRequested  = false;

  // Polling control
  let pollIntervalId = null;
  let stallTimerId   = null;
  let lastSetSize    = 0;

  // Scroll-height stall detection
  let prevScrollHeight = 0;

  // ── Utility: wait ─────────────────────────────────────────────────────────
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // ── Harvest every reel <a> currently visible in the DOM ──────────────────
  function harvestReels() {
    // Aggressive DOM scraping: query all anchors in the main grid
    const anchors = document.querySelectorAll('main a, article a');
    let added = 0;
    anchors.forEach(a => {
      try {
        // Construct an absolute URL (Instagram sometimes uses relative links)
        const urlObj = new URL(a.href, window.location.origin);
        
        // Match both /reel/ and /p/ paths
        if (urlObj.pathname.includes('/reel/') || urlObj.pathname.includes('/p/')) {
          // Strip queries (like ?igsh=...) by using only origin + pathname, and drop trailing slashes
          const cleanUrl = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
          
          if (!reelSet.has(cleanUrl)) {
            reelSet.add(cleanUrl);
            added++;
          }
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    });
    return added;
  }

  // ── HUD injection ────────────────────────────────────────────────────────────
  function injectHUD() {
    if (document.getElementById(HUD_ID)) return; // Already injected

    const hud = document.createElement('div');
    hud.id = HUD_ID;
    hud.innerHTML = `
      <div id="rsb-header">
        <span id="rsb-logo">🎬</span>
        <span id="rsb-title">Reels Second Brain</span>
        <button id="rsb-close-btn" title="Close HUD">✕</button>
      </div>
      <div id="rsb-counter-row">
        <span id="rsb-counter-label">Reels Cached</span>
        <span id="rsb-counter">0</span>
      </div>
      <div id="rsb-status-row">
        <div id="rsb-status-dot" class="idle"></div>
        <span id="rsb-status">Waiting to start…</span>
      </div>
      <div id="rsb-btn-row">
        <button id="rsb-sync-btn" class="rsb-btn primary">⟳ Sync Library</button>
        <button id="rsb-stop-btn" class="rsb-btn danger" disabled>⬛ Stop</button>
      </div>
      <div id="rsb-export-row" style="display:none; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:8px;">
          <button id="rsb-download-btn" class="rsb-btn success">⬇ Download JSON</button>
          <button id="rsb-copy-btn"     class="rsb-btn ghost">📋 Copy URLs</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top: 4px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
          <input type="url" id="rsb-api-url" placeholder="https://your-vercel.app/api/ingest" class="rsb-input" />
          <button id="rsb-push-btn" class="rsb-btn primary">☁ Push to Database</button>
        </div>
      </div>
      <div id="rsb-progress-bar-wrap">
        <div id="rsb-progress-bar"></div>
      </div>
    `;

    // ── Inline styles (self-contained, no external deps) ────────────────────
    const style = document.createElement('style');
    style.textContent = `
      /* ── HUD Container ── */
      #${HUD_ID} {
        all: initial;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        width: 300px;
        background: linear-gradient(145deg, #0d0d0d 0%, #1a1a2e 100%);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        box-shadow:
          0 24px 60px rgba(0,0,0,0.7),
          0 0 0 1px rgba(255,255,255,0.04) inset,
          0 1px 0 rgba(255,255,255,0.1) inset;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e8e8f0;
        padding: 0;
        overflow: hidden;
        user-select: none;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        animation: rsb-slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }

      @keyframes rsb-slideIn {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0)   scale(1);    }
      }

      /* ── Header ── */
      #rsb-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 16px 12px;
        background: rgba(255,255,255,0.03);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      #rsb-logo  { font-size: 18px; }
      #rsb-title {
        flex: 1;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.3px;
        background: linear-gradient(90deg, #a78bfa, #60a5fa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      #rsb-close-btn {
        all: unset;
        cursor: pointer;
        color: rgba(255,255,255,0.3);
        font-size: 12px;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 4px;
        transition: color 0.2s, background 0.2s;
      }
      #rsb-close-btn:hover {
        color: rgba(255,255,255,0.8);
        background: rgba(255,255,255,0.06);
      }

      /* ── Counter ── */
      #rsb-counter-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 16px 4px;
      }
      #rsb-counter-label {
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: rgba(255,255,255,0.35);
      }
      #rsb-counter {
        font-size: 28px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        background: linear-gradient(90deg, #a78bfa, #60a5fa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        transition: transform 0.15s ease;
      }
      #rsb-counter.bump {
        transform: scale(1.25);
      }

      /* ── Status ── */
      #rsb-status-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 16px 14px;
      }
      #rsb-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        transition: background 0.3s ease;
      }
      #rsb-status-dot.idle    { background: rgba(255,255,255,0.2); }
      #rsb-status-dot.active  { background: #34d399; box-shadow: 0 0 8px #34d39988; animation: rsb-pulse 1.4s infinite; }
      #rsb-status-dot.waiting { background: #fbbf24; box-shadow: 0 0 8px #fbbf2488; animation: rsb-pulse 2s infinite; }
      #rsb-status-dot.done    { background: #a78bfa; box-shadow: 0 0 8px #a78bfa88; }
      #rsb-status-dot.stopped { background: #f87171; }

      @keyframes rsb-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
      }

      #rsb-status {
        font-size: 12px;
        color: rgba(255,255,255,0.55);
        font-style: italic;
        line-height: 1.4;
      }

      /* ── Buttons ── */
      #rsb-btn-row, #rsb-export-row {
        display: flex;
        gap: 8px;
        padding: 0 14px 14px;
      }
      .rsb-btn {
        all: unset;
        flex: 1;
        text-align: center;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        padding: 9px 10px;
        border-radius: 10px;
        letter-spacing: 0.2px;
        transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
        white-space: nowrap;
      }
      .rsb-btn:not(:disabled):hover   { transform: translateY(-1px); opacity: 0.9; }
      .rsb-btn:not(:disabled):active  { transform: translateY(0);    }
      .rsb-btn:disabled               { opacity: 0.3; cursor: not-allowed; }

      .rsb-btn.primary {
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
        color: #fff;
        box-shadow: 0 4px 14px rgba(124,58,237,0.4);
      }
      .rsb-btn.primary:hover { box-shadow: 0 6px 20px rgba(124,58,237,0.55); }

      .rsb-btn.danger {
        background: rgba(239,68,68,0.12);
        color: #f87171;
        border: 1px solid rgba(239,68,68,0.25);
      }
      .rsb-btn.danger:hover { background: rgba(239,68,68,0.2); }

      .rsb-btn.success {
        background: linear-gradient(135deg, #059669, #10b981);
        color: #fff;
        box-shadow: 0 4px 14px rgba(5,150,105,0.35);
      }

      .rsb-btn.ghost {
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.55);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .rsb-btn.ghost:hover { background: rgba(255,255,255,0.09); }

      /* ── Inputs ── */
      .rsb-input {
        width: 100%;
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: #fff;
        padding: 8px 10px;
        font-family: inherit;
        font-size: 11px;
        outline: none;
        transition: border-color 0.2s;
      }
      .rsb-input:focus { border-color: #7c3aed; }
      .rsb-input::placeholder { color: rgba(255,255,255,0.3); }

      /* ── Progress Bar ── */
      #rsb-progress-bar-wrap {
        height: 3px;
        background: rgba(255,255,255,0.05);
        overflow: hidden;
      }
      #rsb-progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #7c3aed, #60a5fa, #34d399);
        background-size: 200% 100%;
        transition: width 0.4s ease;
        animation: rsb-shimmer 2.5s linear infinite;
      }
      @keyframes rsb-shimmer {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(hud);

    // ── Wire up button handlers ──────────────────────────────────────────────
    document.getElementById('rsb-sync-btn').addEventListener('click', startSync);
    document.getElementById('rsb-stop-btn').addEventListener('click', requestStop);
    document.getElementById('rsb-close-btn').addEventListener('click', removeHUD);
    document.getElementById('rsb-download-btn').addEventListener('click', downloadJSON);
    document.getElementById('rsb-copy-btn').addEventListener('click', copyURLs);
    document.getElementById('rsb-push-btn').addEventListener('click', pushToDatabase);
  }

  // ── HUD helpers ──────────────────────────────────────────────────────────────
  function setStatus(text, dotClass = 'idle') {
    const statusEl = document.getElementById('rsb-status');
    const dotEl    = document.getElementById('rsb-status-dot');
    if (statusEl) statusEl.textContent = text;
    if (dotEl) {
      dotEl.className = '';
      dotEl.classList.add(dotClass);
    }
  }

  function setCounter(n) {
    const el = document.getElementById('rsb-counter');
    if (!el) return;
    el.textContent = n.toLocaleString();
    // Bump animation
    el.classList.remove('bump');
    void el.offsetWidth; // reflow trick
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 200);
  }

  function setProgress(pct) {
    const bar = document.getElementById('rsb-progress-bar');
    if (bar) bar.style.width = Math.min(100, pct) + '%';
  }

  function setButtonState(isSyncing) {
    const syncBtn = document.getElementById('rsb-sync-btn');
    const stopBtn = document.getElementById('rsb-stop-btn');
    if (syncBtn) syncBtn.disabled = isSyncing;
    if (stopBtn) stopBtn.disabled = !isSyncing;
  }

  function showExportRow() {
    const row = document.getElementById('rsb-export-row');
    if (row) row.style.display = 'flex';
  }

  function removeHUD() {
    requestStop();
    const hud   = document.getElementById(HUD_ID);
    const style = document.querySelector('style[data-rsb]');
    if (hud)   hud.remove();
    if (style) style.remove();
  }

  // ── Core polling engine ───────────────────────────────────────────────────────
  /**
   * stopPolling — clears both the poll interval and the stall timer.
   */
  function stopPolling() {
    if (pollIntervalId !== null) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    if (stallTimerId !== null) {
      clearTimeout(stallTimerId);
      stallTimerId = null;
    }
  }

  /**
   * scrollToBottom — smooth scroll to the very end of the page.
   */
  function scrollToBottom() {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  /**
   * startPollCycle — begins a single poll cycle after a scroll.
   * Resolves when either:
   *   (a) new reels are discovered → resolve(true)   → caller should scroll again
   *   (b) stall timeout expires   → resolve(false)  → caller checks scroll height
   */
  function startPollCycle() {
    return new Promise(resolve => {
      lastSetSize = reelSet.size;

      // Arm the stall timeout first
      stallTimerId = setTimeout(() => {
        stopPolling();
        resolve(false); // timed out — no new reels found
      }, STALL_TIMEOUT_MS);

      // Fast poll to detect new reels
      pollIntervalId = setInterval(() => {
        if (stopRequested) {
          stopPolling();
          resolve(false);
          return;
        }

        harvestReels();

        if (reelSet.size > lastSetSize) {
          // 🎉 New reels detected!
          stopPolling();
          setCounter(reelSet.size);
          setStatus(`Scrolling & syncing… (${reelSet.size} found)`, 'active');
          resolve(true); // signal: scroll again
        }
      }, POLL_INTERVAL_MS);
    });
  }

  // ── Main sync loop ────────────────────────────────────────────────────────────
  async function startSync() {
    if (syncing) return;
    syncing       = true;
    stopRequested = false;

    reelSet.clear();
    setCounter(0);
    setButtonState(true);
    setProgress(0);
    setStatus('Harvesting visible reels…', 'active');

    // Hide export row from a previous run
    const exportRow = document.getElementById('rsb-export-row');
    if (exportRow) exportRow.style.display = 'none';

    // Initial harvest before any scrolling
    harvestReels();
    setCounter(reelSet.size);

    prevScrollHeight = document.body.scrollHeight;

    // Animated progress bar fills indefinitely while syncing
    let fakePct = 5;
    const fakeProgressId = setInterval(() => {
      fakePct = Math.min(fakePct + 0.4, 90);
      setProgress(fakePct);
    }, 300);

    setStatus('Scrolling to bottom…', 'active');

    let consecutiveStalls = 0;
    const MAX_STALLS = 2; // two stall rounds without scroll-height change = truly done

    while (!stopRequested) {
      scrollToBottom();

      // Brief pause to let Instagram's virtual list render new cards
      await wait(SCROLL_PAUSE_MS);

      if (stopRequested) break;

      setStatus('Polling for new reels…', 'waiting');

      const gotNew = await startPollCycle();

      if (stopRequested) break;

      if (gotNew) {
        consecutiveStalls = 0;
        setStatus(`Scrolling & syncing… (${reelSet.size} found)`, 'active');
      } else {
        // No new reels during this pass — check scroll height
        const currentScrollHeight = document.body.scrollHeight;

        if (currentScrollHeight > prevScrollHeight) {
          // Page has grown → more content loaded but maybe not reel links yet
          prevScrollHeight = currentScrollHeight;
          consecutiveStalls = 0;
          setStatus('Page expanded — re-polling…', 'waiting');
        } else {
          consecutiveStalls++;
          setStatus(`Network delay… retrying (${consecutiveStalls}/${MAX_STALLS})`, 'waiting');

          if (consecutiveStalls >= MAX_STALLS) {
            // Truly reached the end
            break;
          }
        }
      }
    }

    clearInterval(fakeProgressId);

    // Final harvest sweep to catch anything we may have missed
    harvestReels();
    setCounter(reelSet.size);
    setProgress(100);

    const finalCount = reelSet.size;
    if (stopRequested) {
      setStatus(`Stopped. ${finalCount} reel${finalCount !== 1 ? 's' : ''} cached.`, 'stopped');
    } else {
      setStatus(`✓ Sync complete — ${finalCount} reel${finalCount !== 1 ? 's' : ''} found!`, 'done');
    }

    // Log to console
    const urlArray = [...reelSet];
    console.group('%c[Reels Second Brain] Sync Results', 'color:#a78bfa;font-weight:bold;font-size:14px');
    console.log(`Total unique reels: ${urlArray.length}`);
    console.log('URLs:', urlArray);
    console.groupEnd();

    setButtonState(false);
    showExportRow();

    syncing = false;
  }

  // ── Stop handler ─────────────────────────────────────────────────────────────
  function requestStop() {
    if (!syncing) return;
    stopRequested = true;
    stopPolling();
  }

  // ── Export handlers ───────────────────────────────────────────────────────────
  function downloadJSON() {
    const data = {
      exportedAt : new Date().toISOString(),
      source     : window.location.href,
      totalReels : reelSet.size,
      reels      : [...reelSet].map((url, i) => ({ id: i + 1, url }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `reels-second-brain-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function copyURLs() {
    const text = [...reelSet].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('rsb-copy-btn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
    });
  }

  async function pushToDatabase() {
    const inputUrl = document.getElementById('rsb-api-url').value.trim();
    if (!inputUrl) {
      setStatus('Please enter an API Endpoint', 'stopped');
      return;
    }

    const btn = document.getElementById('rsb-push-btn');
    const origText = btn.textContent;
    btn.textContent = 'Pushing...';
    btn.disabled = true;
    setStatus('Pushing to Vercel API...', 'waiting');

    const payload = {
      exportedAt: new Date().toISOString(),
      source: window.location.href,
      totalReels: reelSet.size,
      reels: [...reelSet].map((url, i) => ({ id: i + 1, url }))
    };

    try {
      const res = await fetch(inputUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const result = await res.json();
      setStatus(`✓ Success: ${result.inserted} inserted, ${result.skipped} skipped`, 'done');
      btn.textContent = '✓ Pushed';
      btn.classList.replace('primary', 'success');
      
    } catch (err) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`, 'stopped');
      btn.textContent = origText;
      btn.disabled = false;
    }
  }

  // ── Route watcher: inject HUD only on saved-reels pages ────────────────────
  function checkRoute() {
    if (PAGE_PATTERN.test(window.location.href)) {
      injectHUD();
    } else {
      // Remove HUD if user navigated away
      const hud = document.getElementById(HUD_ID);
      if (hud) {
        requestStop();
        hud.remove();
      }
    }
  }

  // Instagram is a SPA — watch for navigation events
  let lastHref = window.location.href;

  // MutationObserver catches Instagram's SPA route changes
  const navObserver = new MutationObserver(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      checkRoute();
    }
  });
  navObserver.observe(document.body, { childList: true, subtree: true });

  // Also listen to popstate / hashchange
  window.addEventListener('popstate', checkRoute);
  window.addEventListener('hashchange', checkRoute);

  // Initial check
  checkRoute();

})();
