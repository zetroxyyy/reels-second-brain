# Reels Second Brain — Chrome Extension Walkthrough

## What Was Built

A complete, production-ready Chrome Extension (Manifest V3) that systematically extracts every saved Instagram Reel URL without missing a single one.

---

## File Structure

```
reels-second-brain/
├── manifest.json        ← MV3 manifest with all permissions
├── content.js           ← HUD + Dynamic Delta Polling engine (566 lines)
├── popup.html           ← Toolbar icon popup with instructions
├── icons/
│   ├── icon16.png       ← Generated AI icon, 16×16
│   ├── icon48.png       ← Generated AI icon, 48×48
│   └── icon128.png      ← Generated AI icon, 128×128
├── make_icons.ps1       ← Helper script used to resize icons
└── README.md            ← Full documentation
```

---

## Task Completion

| Task | Status | Notes |
|---|---|---|
| Task 1: Manifest & Setup | ✅ Done | MV3, `activeTab`, `scripting`, `storage`, host perms, content script at `document_idle` |
| Task 2: HUD UI | ✅ Done | Dark glassmorphism widget, counter, status dot, progress bar, Sync/Stop/Download/Copy buttons |
| Task 3: Dynamic Delta Polling | ✅ Done | `setInterval` @ 200ms, 5s stall timeout, scroll-height double-check, 2 consecutive stalls = done |
| Task 4: Export | ✅ Done | `console.group` output, Download JSON (Blob URL), Copy URLs to clipboard |

---

## Architecture: Dynamic Delta Polling Engine

```
startSync()
  │
  ├─ Initial harvest (reads all visible /reel/ anchors → Set)
  │
  └─ WHILE loop:
       ├─ scrollToBottom()
       ├─ wait 600ms  (Instagram virtual list render time)
       │
       └─ startPollCycle()  ← returns Promise<bool>
            │
            ├─ setInterval @ 200ms → harvestReels()
            │    └─ Set.size grew? → resolve(true) → clear both timers
            │
            └─ setTimeout @ 5000ms → resolve(false) if no growth
                 │
                 └─ Caller checks scrollHeight delta:
                      ├─ grew  → reset stall counter, loop again
                      └─ same  → stall++ → if ≥ 2 → BREAK (truly done)
```

**Key guarantees:**
- URLs are stored in a `Set` — no duplicates, ever
- Query params and trailing slashes are stripped for canonical URLs
- `stopRequested` flag is checked at every async boundary
- A final `harvestReels()` sweep runs after the loop exits

---

## HUD Design Highlights

- **Dark glassmorphism** with `backdrop-filter: blur(20px)` and gradient border
- **Slide-in animation** using `cubic-bezier(0.34, 1.56, 0.64, 1)` spring curve
- **Animated counter** with `.bump` scale animation on every update
- **3-state status dot**: green pulse (active) / amber pulse (waiting) / purple (done) / red (stopped)
- **Shimmer progress bar** with gradient animation
- **SPA-aware**: `MutationObserver` + `popstate`/`hashchange` listeners auto-show/hide the HUD as Instagram navigates

---

## How to Install

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `reels-second-brain/` folder
4. Navigate to `instagram.com/YOUR_USERNAME/saved/all-posts/`
5. HUD appears → click **Sync Library**

---

## Export Format

```json
{
  "exportedAt": "2025-06-14T10:30:00.000Z",
  "source": "https://www.instagram.com/username/saved/all-posts/",
  "totalReels": 247,
  "reels": [
    { "id": 1, "url": "https://www.instagram.com/reel/ABC123/" },
    { "id": 2, "url": "https://www.instagram.com/reel/DEF456/" }
  ]
}
```
