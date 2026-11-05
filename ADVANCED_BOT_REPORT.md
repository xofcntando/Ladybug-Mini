# 🐞 Ladybug Mini — Advanced Edition

**Build report, verification & comparison**

This document records what was analysed, what was fixed, what was added, and
the exact verification results for the **Advanced Edition** of Ladybug Mini —
a WhatsApp MD (multi-device) bot built on Baileys.

---

## 1. What was analysed

| Repo | Role | Command files | Categories | Utils | Baileys |
|------|------|---------------|------------|-------|---------|
| `xofcntando/Ladybug-Mini` | Target (this repo) | 147 | 13 | 40 | v7.0.0-rc |
| `mruniquehacker/KnightBot-Mini` | Upstream base | 132 | 10 | 37 | v7.0.0-rc |
| `mruniquehacker/Knightbot-MD` | Older MD lineage | 106 (flat) | flat files | 0 | `@adiwajshing/baileys` |

**Conclusion of the "check KnightBot Mini and MD" step:** Ladybug Mini is a
rebranded, extended fork of **KnightBot-Mini** (confirmed in the repo credits
and in `index.js`, which still accepts legacy `KnightBot!` session strings).
It is *more advanced* than both bases: it adds `ladybug`, `prank` and `premium`
command packs, a shared visual theme (`utils/ladybugTheme.js`), a premium
licence system, and a much larger modular `utils/` layer. Knightbot-MD is the
older flat-file lineage with an outdated Baileys fork and no modular utils.

---

## 2. Errors found & fixed

A full sweep (syntax check + runtime module-load + command-registry audit) of
all 191 JavaScript files surfaced two real defects, both now fixed:

### 2.1 `commands/general/tg.js` failed to load (native `canvas` missing)
`utils/tgsToWebp.js` did `const { Canvas } = require('canvas')` at the top of
the file. On hosts where the native cairo/pango `canvas` build is unavailable,
the `require` throws at load time, which makes the whole `.tg` command vanish
from the registry.

**Fix:** a resilient loader that prefers the native `canvas` build when present
and otherwise falls back to the prebuilt, dependency-free `@napi-rs/canvas`
(already a project dependency). `.tg` now loads on every host.

```js
let Canvas;
try { ({ Canvas } = require('canvas')); }
catch (_) { ({ Canvas } = require('@napi-rs/canvas')); }
```

### 2.2 Duplicate `translate` command (silent overwrite)
Both `commands/general/translate.js` and `commands/utility/translate.js`
registered the name `translate`. Because the loader scans categories
alphabetically, the `utility` one silently overwrote the `general` one — a
classic "why did my command change behaviour?" bug.

**Fix:** the two were merged into a single, strictly better command in
`commands/general/translate.js` (see §3.1) and the duplicate file was removed.

---

## 3. Advanced features added

### 3.1 Advanced `.translate` (merged + hardened)
- Three usage patterns: `<lang> <text>`, `<text> <lang>`, and **reply + `<lang>`**.
- Friendly language names (`french`, `japanese`, …) resolved to ISO codes.
- **Multi-provider fallback chain**: Google gtx → MyMemory → Siputzx → Dreaded,
  so one dead mirror never breaks translation. Verified live: Google is
  IP-rate-limited in the sandbox (HTTP 429), and the command transparently fell
  through to MyMemory and returned **"Hola mundo"** for *"Hello world"* → `es`.

### 3.2 `.diag` / `.health` / `.doctor` — live self-diagnostics
A new command that reports uptime, Node/platform, CPU load, heap + RSS, system
RAM bar, event-loop latency with a plain-language verdict, live command-registry
count, prefix/mode, and the status of the optional native dependencies
(`canvas` backend, `sharp`, `ffmpeg`, `baileys`) — each check wrapped so a
missing module is reported as a warning instead of throwing.

### 3.3 `.reload` — owner hot-reload
Rebuilds the entire command registry from disk **without restarting the
process**. Implemented via `handler.reloadCommands()`, which purges the
`require` cache for `/commands` and rebuilds the live (mutable) `Map` in place.
Perfect for editing commands on a live panel.

---

## 4. Verification results (all green)

```
Syntax check (191 JS files) ......... 0 failures
Core module load .................... OK (config, database, handler, commandLoader, theme)
Command registry .................... 726 entries / 277 unique modules
Commands missing execute() .......... NONE
Duplicate command names ............. NONE
Live command execution (mock) ....... .diag ✅  .translate ✅  .reload ✅
Live translate (real network) ....... "Hello world" → "Hola mundo" ✅
```

Category breakdown (unique modules):

`admin 29 · fun 77 · premium 35 · general 26 · owner 24 · economy 19 ·
textmaker 18 · prank 12 · media 11 · games 10 · ladybug 8 · anime 4 · ai 2 ·
utility 2`

---

## 5. How to run

```bash
npm install
# Option A — session string (recommended)
#   put it in config.js -> sessionID: 'Ladybug!H4.....'
# Option B — QR
#   leave sessionID empty and run, then scan the QR
node index.js
```

Useful new commands once connected:

| Command | What it does |
|---------|--------------|
| `.diag` | Full live health check |
| `.reload` | Hot-reload commands (owner only) |
| `.translate <lang> <text>` | Translate (reply or inline, multi-provider) |

---

## 5.1 YouTube downloader fixes (`.song` / `.video`)

The media downloaders were the main runtime crash source. Fixes applied:

- **`ffmpeg-static` ENOENT crash** — `.video` spawned a missing `ffmpeg-static`
  binary and the unhandled `'error'` event killed the whole process. Added a new
  resilient resolver `utils/ffmpeg.js` (env `FFMPEG_PATH` → existing
  `ffmpeg-static` file → system `ffmpeg`), guarded `inspectMedia`/`runFfmpeg`,
  and made `toWhatsAppMp4` copy through when no ffmpeg is available.
- **`utils/converter.js`** now uses the same resolver instead of blindly
  `require('ffmpeg-static')` (which returns a path even when the file is absent).
- **`.song` latency** — the dead Hector API was tried first with two ~25s
  timeouts, making every request take ~55s. Reordered so **Knight API runs
  first** and Hector last; added a **local `yt-dlp` fallback**. Measured:
  **4.4s** (was ~55s), 2.7 MB MP3 delivered successfully.
- **`.video` size guard** — videos over WhatsApp's 64 MB limit now produce a
  friendly warning instead of a silent failed send (a 90 MB test video now
  correctly reports "86.4 MB exceeds 64 MB limit").

Verification: 191 JS files pass `node --check`; registry loads **726 entries /
0 missing `execute`**; live mock-socket runs of `.song` (4.4s) and `.video`
(20.9s) complete without crashing.

---

## 6. Notes & caveats

- This bot requires a **WhatsApp session** (pair code / QR) to actually connect;
  all verification above is done at the module, registry and command-execution
  level (no live WhatsApp account in the sandbox).
- Third-party WhatsApp bots may violate WhatsApp's Terms of Service. Use at your
  own risk — see the project's existing warning/legal sections.
- Optional native modules (`canvas`, `sharp`, `ffmpeg-static`, `puppeteer`) are
  best-effort; the code now degrades gracefully when a native build is missing.
