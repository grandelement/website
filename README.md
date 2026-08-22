# 🌌 **Grand Element Studios – Master Website (GE Radio & Planet Game)**

**Creator:** **Scott Rundquist**
**Band Members:**

* **Scott Rundquist** – founder, keyboards, composition, vocals (energy voice), producer
* **Mike Venniro** – drums, percussion
* **Evan Donahue** – guitar
* **Wills Blackmore** – drums, percussion, sound engineering
* **Shane Willy** – bass guitar
* **Latheori Trice** – bass guitar (early member)
* **Ronaldo Elliott** – drums (reggae influence)
* **Elizabeth “Liz” Washington** – vocals

---

## 🎯 **Purpose and Vision**

The Grand Element Studios website is a **self-contained, interactive world** that fuses music, animation, and sacred geometry.
It serves as both a **music portal** and a **visual cosmic experience**:

1. **Grand Element Radio** — A full music player with shuffle, album modes, and visual audio sync.
2. **The Planet Game** — A live, physics-based cosmic “pool” game built into the world’s visual layer.

The site reflects *energy, harmony, and geometry through sound.*

---

## 🧩 **Core Systems**

### 1. Blue Sun / Moon / Planet System

* The **Blue Sun** anchors the universe (fixed left side).
* The **Moon** orbits the Blue Sun smoothly in perfect circular 2D motion (no flipping).
* **Planets** represent Grand Element albums, each clickable and linked to its album page or playlist.
* Planets orbit in sacred geometric alignment.

---

### 2. Background & Visual Layers

* Multi-layer depth rendering:

  * **Stars Background:** shuffled static images (`/images/stars backgrounds/` folder).
  * **Comets and Ships:** move dynamically with particle effects.
  * **Planets:** center album icons; clickable and reactive.
* Layer order must remain stable:
  `background → comets → planets → HUD → overlays`.

---

### 3. Grand Element Radio

* Full audio playback system for `/music` and `/clips` folders.
* Two modes:

  * **Shuffle Mode:** “Album • Song”
  * **Album Mode:** “Album • ## • Song”
* No break when switching modes.
* Automatically loads any new audio files in `/music` and `/clips`.
* Inserts one clip every 4–5 songs.

---

### 4. HUD and Game Overlay

* **Top-left corner:** Red and Blue score numbers (no text labels).
* **Start/Stop button** toggles gameplay.
* **Countdown** appears in subtle small font (3…2…1…GO).
* Ships, large comets, and moon **fade out** when gameplay begins.
* Background stars and micro-ships keep running.

---

### 5. The Planet Game

* **Trigger:** grabbing either the red or blue mini-sun (cue ball) opens a modal prompt:

  > “Do you wish to play the Planet Game?”
  > [Yes] [No]
* If “Yes”:

  * HUD activates.
  * Foreground elements fade.
  * Cue-balls, comets, and planets share one unified **physics plane**.
  * Collisions transfer force; planets move and score increments.
  * Comets and cue-balls now bounce off planets naturally.
* If “No”: the world stays ambient and musical only.

---

### 6. Sacred Geometry Motion

* Ships, comets, and planets follow sacred geometric paths.
* Comets gravitate and orbit planets when nearby (360° swing before departure).
* When 13 comets are on screen, they form a rotating sacred geometry ring before dispersing.
* Interactions maintain symmetrical, non-chaotic flow.

---

## 🧱 **Technical Structure**

| Layer                 | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| **index.html**        | Single master file (all HTML/CSS/JS inline).                                 |
| **FX Canvas (`#fx`)** | Handles cue-balls, comets, ships, and physics rendering.                     |
| **DOM Planet Layer**  | HTML-based album buttons; mirrored into canvas physics as invisible proxies. |
| **HUD Layer**         | Displays score, countdown, and controls.                                     |
| **Modal Layer**       | Prompt modal for starting Planet Game.                                       |
| **Background Layer**  | Shuffled star backgrounds loaded from manifest.                              |

---

## 🗂 **Repository Layout**

```
/index.html                 ← master single file (all features inline)
/music/                     ← MP3 albums
/clips/                     ← interstitial clips
/images/                    ← visual assets
/images/stars backgrounds/  ← shuffled background images
/images/planets/            ← album planet images
```

---

## 🧩 **Codex / GitHub Build Instructions**

**Codex Objectives**

1. Maintain a **single unified index.html file** — no external scripts or libraries.
2. Never remove working layers; all updates must be **append-only**.
3. Ensure red/blue **mini-suns** are fully interactive, share same plane as planets during gameplay, and follow pool-ball physics.
4. Keep **music and shuffle system stable** — no interruptions when switching modes.
5. Respect strict visual hierarchy:

   * Blue Sun fixed left.
   * Moon orbits smoothly.
   * Planets clickable and album-linked.
6. Foreground fade and background persistence must work seamlessly.
7. All new code must work offline (no CDN dependencies).

---

### 🧠 **Codex Tasks**

* Preserve and improve **Planet Game physics** (momentum, collision accuracy).
* Allow **mini-suns to trigger** the gameplay modal.
* Maintain **fade hierarchy** and **sacred geometry comet patterns**.
* Keep **manifest.json** background loader for offline directory safety.
* Add **proxy body system** that maps DOM planet positions to canvas coordinates.

---

### ⚙️ **Manifest File Format**

File: `/images/stars backgrounds/manifest.json`

```json
[
  "stars01.jpg",
  "stars02.jpg",
  "nebulaA.jpg",
  "cosmos5.png"
]
```

*(Load order randomized on page start.)*

---

## 🚀 **Performance Guidelines**

* Cap comet spawn rate to ~50% of original frequency.
* Use lightweight physics loops (avoid browser freeze).
* Keep aim overlay and modal in top z-layer (`z-index:1300`).
* Maintain <60% CPU usage during idle playback.

---

## 🪙 **Copyright and Credit**

© **2025 Grand Element Studios**
All Rights Reserved.
Created by **Scott Rundquist** and **Grand Element**
(including Mike Venniro, Evan Donahue, Wills Blackmore, Shane Willy, Latheori Trice, Ronaldo Elliott, and Elizabeth “Liz” Washington).

Music, visuals, and creative design are property of **Grand Element Studios**.
No reproduction or modification without written permission.
