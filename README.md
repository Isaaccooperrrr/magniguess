# Magniguess

An order-of-magnitude estimation game. Open `index.html` in a browser and play —
no build step, no dependencies, no network calls.

## The game

Every answer is a number, and you never type it: you place it on a logarithmic
slider running from 1 to a trillion.

Scoring is the same everywhere in the game:

```
points = max(0, round(100 - 20 × |log10(guess) - log10(actual)|))
```

100 for a bullseye, decaying 20 points per order of magnitude. Streaks build on
every question you survive and reset the moment you miss.

## Modes

Picked from the home page. Each is the same loop with different dials — how many
lives, how much slack counts as surviving, whether a clock runs, which bank.

| Mode | Lives | Slack | Clock | Bank |
| --- | --- | --- | --- | --- |
| **Survival** | 3 | 1.5 OOM | — | questions |
| **Daily** | 3 | 1.5 OOM | — | questions, date-seeded |
| **Time attack** | none | 1.5 OOM | 90s | questions |
| **Sudden death** | 1 | 1.0 OOM | — | questions |
| **Practice** | none | 1.5 OOM | — | endless, unscored |
| **Size it up** | 3 | 1.5 OOM | — | objects |
| **Pass and play** | — | 1.5 OOM | — | 2–4 on one device |
| **Play online** | — | 1.5 OOM | — | room code, up to 6 |

Adding a mode is adding an entry to `MODES`; everything reads from it.

## Size it up

No numbers. Each round names an object and you stretch its silhouette until it
looks right beside a fixed 1.7 m human standing on the ground line. On confirm
the shape grows or shrinks to the truth while the camera pulls back to fit.

Every object has its own flat SVG silhouette in `ART`. Each drawing's viewBox
sets its natural proportions; `unit` says which axis was measured ("metres
long" lays the object out horizontally, "metres tall" vertically), and an
optional `ratio` (real width/height) overrides the drawing where the silhouette
is stylised more than the real thing — a blue whale is 30 m long and 4 m tall,
not 30 m tall.

**Two ways to resize**, chosen on the home page and remembered:

- **Slider** — a logarithmic slider under the scene.
- **Dragging the corner** — no slider at all; grab the grip on the shape's
  top-right corner and pull out. Arrow keys work on the focused shape either
  way, and the shape itself is always draggable.

Both write the same log-metres value, and the mapping is relative (260 px of
travel is one order of magnitude) rather than "the corner follows your finger":
growing the object zooms the camera out, so an absolute mapping would chase its
own tail.

Objects carry the same `{prompt, answerValue, unit, category}` shape as a
question, with `answerValue` in metres, so scoring, lives, streaks, stats,
recap and sharing all run unchanged — only the input widget differs.

The camera is one number, `ppm` (pixels per metre); every rendered dimension is
`realMetres × ppm`. Each frame it eases toward whichever is tighter — fitting
the tallest thing vertically, or both figures side by side horizontally — never
snapping. Its `dt` is clamped at both ends, so neither a long pause nor a
non-monotonic timestamp can blow the easing up. Shapes clamp to a 3 px floor and become tick marks
below it. The always-present human bounds zoom-in on its own, with `MAX_PPM` as
a backstop. `paintScene()` refuses to run without layout, and a `ResizeObserver`
redraws on any box change, so the scene is correct even if the animation loop
never runs.

The object bank does not map onto the five trivia categories, so this mode opts
out of the category filter the same way Daily does.

## Multiplayer

**Pass and play** is 2–4 people on one device. Everyone answers the same
question before anything is revealed — an opaque overlay covers the card
between turns — then every guess lands on the log scale at once, colour-coded,
with a scoreboard between rounds. Needs nothing: no network, no hosting.

**Play online** is a room code and everyone on their own device. It uses WebRTC
through PeerJS's free public broker, so there is no account to make, no server
to run and nothing to pay. The host creates a room, reads out the four-letter
code, and holds the authoritative state; guests render whatever they are sent.

The deck is never transmitted — both sides rebuild it from the room's seed, the
same trick challenge links use. Messages are only `hello`, `guess` and `state`.
Scores are awarded once per round, by the host, in `roomReveal`.

The room logic (`newRoom`, `roomJoin`, `roomStart`, `roomGuess`, `roomReveal`,
`roomNext`) is deliberately a set of plain functions over one object, so it can
be tested without a network.

Two things to know before relying on it:

- **Serve the page over https.** WebRTC from a `file://` page is unreliable, and
  a friend needs a URL to open anyway. Free static hosting covers this.
- **The public broker is best-effort.** It is free and unauthenticated, so it
  can be slow or rate-limited, and a small number of strict corporate or mobile
  networks block peer-to-peer entirely without a TURN relay. Swap `PEERJS_SRC`
  and the `Peer` options for your own PeerServer if it ever matters.

## Category filter

Narrows the deck to one of five categories (43–55 questions each) instead of the
full 238. Applies to every mode except Daily and Size it up.

## Challenge links

`hashSeed(string)` drives the shuffle — Daily feeds it the date, a challenge
feeds it a shared code. **Challenge a friend** on the game over screen mints a
code and copies a `?seed=&mode=&cat=` link; opening it reproduces the identical
deck, with no backend. Params are validated against the known modes and
categories, and changing mode or category drops out of the challenge rather than
silently serving a different deck.

## Stats and badges

Every answer records count, points, hits and summed log error against its
category, in one storage key. **Your record** shows lifetime accuracy, a
per-category breakdown with a strongest/weakest verdict, and a case of nine
badges. The hit threshold is a constant rather than the mode's own slack, so
answers from different modes mean the same thing in the totals. Size it up
answers live in their own bucket and never distort the trivia categories.

## Sound

Web Audio oscillator blips, no sample files: a rising triad on a bullseye, two
notes on a survived guess, a low thud on a miss, a falling saw plus
`navigator.vibrate` when a life goes. Mute lives in the header and persists.

## Offline

`manifest.json` plus a cache-first `sw.js` make the game installable and usable
offline. Registration is skipped unless served over http(s), since registering
from `file://` throws — and nothing here is needed for the game to run.

## Storage

All of it goes through `safeGet`/`safeSet`, which swallow the exceptions that
private browsing and sandboxed origins throw on plain access:

| Key | Holds |
| --- | --- |
| `magniguess.best.<mode>.<category>[.<date>]` | high score |
| `magniguess.stats` | lifetime per-category accuracy |
| `magniguess.badges` | unlocked badge ids |
| `magniguess.muted` | sound preference |
| `magniguess.sizeinput` | slider or corner grip |

## Files

- `index.html` — the whole game: styles, both banks, all logic.
- `manifest.json`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png` — PWA only.

Inside `index.html`, worth knowing:

- `posFor(log)` — log value to track position, correcting for the slider thumb's
  width so ticks and markers line up with the knob.
- `mulberry32` / `shuffled` / `hashSeed` — seeded shuffling, shared by Daily and
  challenge links.
- `phase` — `guessing` / `loading` / `revealed` / `over`. It stops a fast second
  Enter skipping a question mid-transition, and discards a card transition whose
  run already ended.
- `cameraTarget()` / `camFrame()` / `paintScene()` — the Size it up camera.
