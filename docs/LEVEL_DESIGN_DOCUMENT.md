# Bus Jam Mobile — 100-Level Campaign Design Document (`LEVEL_DESIGN_DOCUMENT.md`)

## 1. Campaign Overview & Design Philosophy

The **Bus Jam Mobile** 100-level campaign (`src/game/levelGenerator.ts` & `src/game/levelValidator.ts`) is designed around **authentic spatial and queue-management constraints** rather than arbitrary increases in vehicle count:

1. **Deterministic & Reproducible:** Every level (`1..100`) is generated from an individually parameterized `LevelBlueprint` combined with a deterministic Mulberry32 PRNG seed (`levelNumber * 1009 + 7919`), ensuring identical layouts across all Android devices and sessions.
2. **100% Unique Geometric Layouts:** Every level in the 100-level campaign has a distinct spatial vehicle and obstacle footprint (`uniqueGeometryCount === 100`). No two levels are simply duplicates with swapped colors.
3. **100% Solvable Without Boosters:** Every level is verified by both a constructive extraction proof (`solutionOrder`) and an independent depth-first heuristic solver (`solveLevelIndependently`) under the game's actual 4-bay traffic and FIFO boarding rules.

---

## 2. Gradual Mechanic Introduction Schedule

New mechanics and spatial constraints are introduced progressively across 10 transit districts:

| Levels | District Name | Grid Size | Colors | Capacities | Obstacles | Mystery (`?`) | Queue Interleave | Core Mechanic Introduced |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1–2** | Suburban Stop | `6×6` | 3 | `4` | 0 | 0% | 1–2 buses | Basic line-of-sight unblocking & FIFO color matching |
| **3–10** | Suburban Stop | `6×6` | 4 | `4, 6` | 0 | 0% | 2 buses | 6-seat cruisers (length 3) & orthogonal 2-step blocking |
| **11–15** | Crosstown Avenue | `7×7` | 4–5 | `4, 6, 8` | 0 | 0% | 2 buses | 8-seat articulated coaches (length 4) & 4-way crossroads |
| **16–20** | Crosstown Avenue | `7×7` | 5 | `4, 6, 8` | 1–2 | 0% | 2 buses | Static road barriers (`GridObstacle`) creating path chokes |
| **21–30** | Harbor Express | `7×7`–`8×7` | 5 | `4, 6, 8` | 1–2 | 14% | 2 buses | Mystery (`?`) buses whose color stays hidden until unblocked |
| **31–40** | Industrial Yard | `7×7`–`8×7` | 6 | `4, 6, 8` | 2 | 14% | 2–3 buses | 3-bus FIFO queue interleaving across the 4 standard bays |
| **41–50** | Botanical Loop | `8×7`–`8×8` | 6 | `4, 6, 8` | 2–3 | 20% | 3 buses | Spiral vortex & central island multi-ring blocking chains |
| **51–65** | Midtown & Civic | `8×8` | 7 | `4, 6, 8` | 2–3 | 20% | 3 buses | Pinwheel interlocks requiring precise bay staging |
| **66–85** | Financial & Metro | `8×9` | 7–8 | `4, 6, 8` | 2–3 | 20–25% | 3 buses | High-density 8-seat coaches blocking interior shuttles |
| **86–100** | Grand Central | `9×9`–`9×10` | 8 | `4, 6, 8` | 3 | 25% | 3 buses | Master terminal puzzles with all 8 colors & deep chains |

---

## 3. Ten Spatial Layout Archetypes

To ensure genuine structural variety across consecutive levels, each level blueprint selects one of **10 geometric traffic archetypes**:

1. **`OPEN_PLAZA`**: Radial outward-facing formation teaching perimeter lane exits.
2. **`CROSSROADS`**: Intersecting horizontal and vertical transit avenues through the center of the lot.
3. **`PERIMETER_RING`**: Outer ring of buses enclosing an inner core of high-capacity coaches.
4. **`SPIRAL_VORTEX`**: Clockwise rotational flow (`RIGHT` on top, `DOWN` on right, `LEFT` on bottom, `UP` on left).
5. **`DUAL_CORRIDOR`**: Parallel north-south express lanes separated by interior traffic bollards.
6. **`PINWHEEL_LOCK`**: Four-quadrant rotational interlock where each quadrant unblocks the next.
7. **`CHESSBOARD_BAYS`**: Alternating horizontal and vertical coaches in a woven lattice.
8. **`BOTTLENECK_GATE`**: Barrier-framed choke points requiring lateral clearance first.
9. **`CENTRAL_ISLAND`**: Central obstacle island surrounded by concentric vehicle rings.
10. **`TERMINAL_GRID`**: High-density multi-platform terminal bay arrangement.

 Within each 10-level district, vehicle counts follow a rhythmic pacing wave (including a slightly lighter breather puzzle at step 5 and a climax boss puzzle at step 10).

---

## 4. Strategic Booster Opportunities

While every level is 100% solvable without boosters, the level structures naturally create meaningful opportunities for all three Bus Jam boosters:

- **VIP Booster (`VIP`):** Airlifts any blocked interior vehicle (or shifts a non-matching bay bus) directly into the dedicated golden VIP Bay (`bay-vip`), bypassing deep multi-vehicle blocking chains or recovering from a 4-bay jam.
- **Pick Booster (`PICK`):** Magnet-pulls matching passengers from deeper in the interleaved FIFO queue onto a partially filled bay bus so it reaches full capacity (`4/4`, `6/6`, or `8/8`) and vacates its bay immediately.
- **Shuffle Booster (`SHUFFLE`):** Permutes colors among `PARKED_IN_LOT` vehicles of identical capacity (preserving 100% passenger-to-seat parity and zero cell overlaps), prioritizes placing the front passenger's color onto an unblocked bus, and reveals all Mystery (`?`) vehicles in the lot.

---

## 5. Automated Validation & Independent Solver Architecture

Every level (`1..100`) is validated by `validateLevelData` and `validateAll100Levels` in `src/game/levelValidator.ts`:

1. **Grid & Spatial Bounds:** Verifies all vehicle footprints and obstacles lie strictly within `gridWidth × gridHeight` with zero overlapping cells.
2. **Capacity & Passenger Parity:** Verifies every vehicle uses a valid capacity (`4 | 6 | 8`) matching its cell length (`2 | 3 | 4`), and verifies exact 1-to-1 parity between total seats of each color and waiting passengers of that color.
3. **Constructive Solution Simulation:** Simulates the full game engine (`selectAndMoveVehicle` + `resolveAllImmediateBoarding`) across the level's solution sequence with 4 standard bays and 0 boosters, confirming `status === 'LEVEL_COMPLETED'`.
4. **Independent State-Space Solver (`solveLevelIndependently`):** Performs a depth-first heuristic search using only the live game rules (without reading `solutionOrder`) to independently verify solvability.
5. **Campaign-Wide Geometric Uniqueness:** Computes a color-independent geometric signature (`computeLevelGeometrySignature`) for all 100 levels and asserts `uniqueGeometryCount === 100`.
