# Grand Element — Golf, Flight and Meditation Build Bank

Created 2026-10-01. This file preserves the requested design so the games can be built/tested without losing the rules.

## Shared design rule

All GE games use the same planet motion baseline as normal website play. Controls may deliberately modify weight, roll length, bounce, size or power, but entering a game must not silently change the physical feel. Size changes preserve each object's center position.

## GE Golf

### Core rule
- 33 hand-authored holes, progressively harder.
- Rubber-band/slingshot shot control.
- Each Soul chooses an album planet before play.
- Blue Sun is the cup.
- Preferred final cup mechanic: the planet must cross fully inside the Blue Sun capture radius, not merely touch its outside edge. A visible capture/pocket animation confirms the hole.
- Score is strokes. Lowest total wins.
- Hole in one is possible on every hole, including hole 33, through a verified direct or bank route.
- The guide predicts the actual collision geometry. Power changes travel distance, not the reflected angle. Flat-wall rebound obeys the same deterministic physics used by the game.
- Guide Length is a Golf option.
- The guide can preview multiple banks when set long enough.
- If there is insufficient pull-back space on the intended line, the course must provide a bank route and enough usable pull space for the verified hole-in-one route.
- Computer/The Body can play.
- Before hole 1, show concise rules and demonstrate pull-back, release, banks and the Blue Sun cup.

### Natural setup order
1. GOLF
2. Souls: 0–6 / The Body
3. Each Soul chooses one album planet
4. Course: 33 holes
5. Guide Length
6. Rubber Band Power
7. Practice / Play
8. Hole card: hole number, par, strokes, best
9. Course play
10. Results / replay / next hole

### Difficulty progression
1–3 Learn: open direct lines, wide cup approach.
4–6 Aim: one static GE/planet obstacle, forgiving banks.
7–9 Banks: forced single-bank geometry.
10–12 Corridors: narrower lanes, angled walls.
13–15 Choice: direct risky route vs longer bank route.
16–18 Double banks: two-wall solutions and tighter power windows.
19–21 Gates: narrow passages, GE emblem/ship obstacles.
22–24 Timing introduction: slow moving obstacle with generous window.
25–27 Precision: smaller clearances and compound banks.
28–30 Advanced timing: moving obstacles plus bank geometry.
31 Master line: three-bank route.
32 Master timing: narrow moving gate plus bank.
33 GRAND ELEMENT: hardest verified one-shot route; multiple banks, narrow clearances and a slow moving obstacle. Difficult but never random or physically impossible.

Every hole must be solver-tested. Store a reference hole-in-one vector/power and use automated simulation to verify it still works after physics changes.

### Obstacle vocabulary
- hard walls / rails
- angled bank walls
- GE emblem
- ship
- album planets
- gates
- slow moving blockers
- tunnels/corridors represented top-down
- optional speed-control zones later

## GE Flight

### Core rule
- Pilot the existing GE ship through a visually obvious course from START to FINISH.
- The ship itself remains the same ship and control language.
- Touching a course wall/obstacle is a fault/reset/checkpoint according to mode.
- Early courses are wide and slow; later courses become tighter.
- From level 3 onward, slow moving obstacles can require timing and speed control.
- Course geometry always accounts for the full ship hitbox, not merely its center point.
- Advanced levels may have tight gates, but every gate must retain a verified collision-safe path.
- The route should be readable from walls/light rails; dotted guide is optional, not required by default.
- Score can combine completion time + faults, with a precision/clean-run record.

### Progression
Training: wide straight/curved gates.
Navigation: S curves and broad obstacles.
Timing: slow crossing objects.
Precision: narrower gates and compound curves.
Master: moving gates, speed changes, close but fair clearances.

## Meditation / Autopilot

Meditation belongs under AUTOPILOT as a calm mode, not as a competitive game.

### Screen
- Fade into the same calm image used by the Radio/private-message experience once its exact repository asset is identified.
- Album/chakra choices arranged as a coherent color family.
- Each button shows album/chakra name above and frequency below.
- Selecting one starts a generated continuous pure sine tone.
- Left vertical slider: tone volume.
- Right side: optional ambient layers such as ocean, rain, **meditation thunder**, thunderstorm/water.
- Meditation Thunder is its own gentler layer: deep, distant, slow rolling thunder with long quiet gaps, separate from a normal rain/thunderstorm track. It should avoid abrupt close lightning cracks so it can sit behind a meditation tone.
- Ambient volume is independent from tone volume.
- No scoring, timer pressure or game HUD unless the listener explicitly enables a meditation timer.

### Frequency accuracy rule
There is no single scientifically standardized set of "chakra frequencies." Frequencies shown in the interface must therefore be treated as GE's chosen meditation mapping, not labeled as medically or scientifically established chakra frequencies.

### Audio
Pure tones can be generated with Web Audio oscillators, so no large tone files are required. Ambient recordings should be licensed/original assets or procedurally generated where appropriate; do not copy copyrighted recordings from other apps/sites.

## Implementation order
1. Stabilize existing UI/physics defects.
2. Build Golf engine + 33 verified layouts.
3. Build Flight course engine using the existing ship.
4. Add Meditation under Autopilot.
5. Add Back Room visual editors for Golf holes, Flight courses and Meditation mappings.
