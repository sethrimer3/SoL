# Design Decisions

This document records explicit design choices and the logic behind them so future
contributors can understand why the code behaves as it does and can reason about
changes safely.

---

## Photon–Sun Repulsion

### Decision
The sun repels photons that drift too close to its surface.

### Rationale
Photon–photon repulsion and hero gravity can push photons back toward the sun after
they have been ejected.  Without a counter-force, photons can clump right at the sun
edge and never reach the rest of the map.

### Implementation  (`src/sim/systems/photon-system.ts`, `src/constants.ts`)
* `PhotonSystem.applySunRepulsion()` iterates every photon and every sun each tick.
* If a photon's distance to the sun centre is below
  `PHOTON_SUN_REPULSION_RANGE_PX` (90 px), a radially-outward force is applied.
* Force magnitude scales linearly with proximity: strongest right next to the sun,
  zero at the boundary.
* Constants:
  * `PHOTON_SUN_REPULSION_RANGE_PX = 90`  – repulsion starts at this radius
  * `PHOTON_SUN_REPULSION_STRENGTH = 120` – peak acceleration (px/s²) at the sun edge

---

## Asteroid Rotation–Based Photon Push

### Decision
When a rotating asteroid's irregular polygon sweeps into a photon, the photon is
pushed outside the polygon and its velocity is reflected.

### Rationale
The original collision used a simple circle check against `asteroid.size`.  Because
asteroids are irregular polygons that rotate, a vertex can sweep outward by up to
1.32× the nominal radius, passing through photons that were just outside the circle.
Using the actual polygon for fine-phase detection fixes this.

### Implementation  (`src/sim/systems/photon-system.ts`)
* **Broad phase**: discard photons whose distance from the asteroid centre exceeds
  `asteroid.size × 1.35 + PHOTON_RADIUS_PX`.  This factor covers the maximum vertex
  reach (up to 1.32× radius per `generateVertices`) with a small buffer.
* **Fine phase**: `Asteroid.containsPoint()` (ray-casting, world-space polygon).
* **Ejection**: find the closest polygon edge, compute its outward normal, push the
  photon outside by the penetration depth, and reflect the inward velocity component.
* Only one collision is resolved per photon per tick (first hit, then `break`).

---

## Box-Selection Priority Rules for Stellar Forge and Foundry

### Decision
When the player drags a selection box:

| What is in the box                        | Stellar Forge selected? | Foundry selected? |
|-------------------------------------------|------------------------|-------------------|
| Units and/or solar mirrors                | No                     | No                |
| Forge + foundry (no units/mirrors)        | **Yes** (forge wins)   | No                |
| Foundry only (no units/mirrors/forge)     | No                     | **Yes**           |
| Forge only (no units/mirrors)             | **Yes**                | N/A               |
| Other buildings without sub-menus         | Yes (if also in box)   | N/A               |

### Rationale
Both the stellar forge and the foundry open a sub-menu when selected.  Selecting them
at the same time as units or mobile structures would produce ambiguous tap targets.

* **Units / mirrors take absolute priority** because they are the most common action
  targets and the player rarely wants to move the forge or foundry accidentally.
* **Forge takes precedence over foundry** because it is the primary production
  structure and has a more complex sub-menu (hero queue, mirror production).
* **Cannons, gatling towers, and other buildings** (without a sub-menu) are currently
  not box-selectable, so they never block forge or foundry selection.

### Implementation  (`src/input/selection-manager.ts`, `selectUnitsInRectangle`)
1. Collect units and mirrors from the box as before.
2. Check whether a `SubsidiaryFactory` (foundry) is in the box.
3. `canSelectForge`: forge in box AND no units AND no mirrors AND no foundry.
4. `canSelectFoundry`: foundry in box AND no units AND no mirrors AND forge NOT
   selected.
5. Only the winning candidate has `isSelected = true` and is stored in the respective
   selection set.

---

## Direct-Tap Deselect (Multi-Selection Deselect)

### Decision
When multiple items are selected, tapping directly on one of the **selected units**
deselects only that unit and leaves the rest of the selection intact.  The tap does
**not** issue a move order.

### Rationale
Players frequently want to refine an accidental box selection without losing the rest.
The existing behaviour (any tap in empty space = move order for all selected units)
made it hard to remove one unit from a multi-selection.

Structures (forge, mirrors, buildings) are not affected by this rule because tapping
on them already has defined single-tap toggle behaviour.

### Implementation  (`src/input/selection-manager.ts`, `tryDeselectUnitAtPosition`)
* `SelectionManager.tryDeselectUnitAtPosition(worldPos)` is called in the input
  controller right after the forge / mirror / building click checks.
* It only activates when `totalSelected > 1` OR `selectedUnits.size > 1` – a single
  selected unit will still receive a move order on tap.
* Hit radius: `PHOTON_UNIT_TAP_DESELECT_RADIUS_PX = 24` world pixels (slightly larger
  than the visual unit radius of 10 px to be touch-friendly).
* Returns `true` if a deselection occurred; the input controller then returns early
  without processing a move order.

---

## Double-Tap Selects All of the Same Type

### Decision
Double-tapping on any unit or building selects **all** instances of that exact type
that belong to the local player, even those not currently visible on screen.

### Rationale
During large fights the player often wants to rally all units of a type rather than
manually boxing every one of them.  "All of the same type" is unambiguous and maps
well to what players expect from RTS "select all" gestures.

### Supported Types  (`src/input/selection-manager.ts`)
| Tapped entity                  | Result                                    |
|-------------------------------|-------------------------------------------|
| `Starling` (basic minion)      | `selectAllStarlings()` – all starlings    |
| Any hero unit (e.g. Marine)    | `selectAllHeroesOfType(unit)` – all heroes of the same class |
| Any building (e.g. Foundry)   | `selectAllBuildingsOfType(building)` – all buildings of that constructor type |

### Implementation
* In `selectUnitsInRectangle`, the double-tap branch now checks for Starlings first,
  then hero units, then buildings – all within the small tap area.
* `selectAllHeroesOfType(clickedHero)` matches by `unit.constructor` so that
  different hero sub-classes are selected independently.
* Double-tap detection thresholds remain unchanged:
  * `DOUBLE_TAP_THRESHOLD_MS = 300 ms`
  * `DOUBLE_TAP_POSITION_THRESHOLD = 30 px` (screen space)

---

## Stellar Forge vs. Foundry Precedence in Combined Selections

### Decision
If a drag-box captures both the stellar forge and the foundry (and no units or
mirrors), **only the stellar forge is selected**.  The foundry is ignored.

### Rationale
The forge's hero-production and mirror-spawn sub-menu is the more critical action
surface.  Requiring the player to explicitly tap the foundry avoids an ambiguous state
where both sub-menus are simultaneously active.

### Implementation
This falls out of the priority rules described in **Box-Selection Priority Rules**
above.  `canSelectFoundry` is evaluated with `!canSelectForge`, so when the forge
wins, the foundry check never fires.

---

## Single-Tap Forge / Foundry Selection (not box drag)

Both the stellar forge and the foundry retain their existing single-tap toggle
behaviour:
* Tapping on the forge while nothing else is selected → selects the forge.
* Tapping the forge again → deselects it.
* Same for the foundry.

These rules exist in `InputController.setupInputHandlers()` and are **not** changed
by this set of updates.
