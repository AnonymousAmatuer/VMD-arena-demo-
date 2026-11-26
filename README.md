# VMD Championship — The Platypus 3D Engineer

A playable, single-player vehicle engineering game built with Next.js App Router, Three.js, Cannon-es, PostgreSQL, and Drizzle ORM. Original cinematic artwork introduces the factory machine; editing, driving, projectiles, and destruction run in a real-time 3D simulation.

## Play

The workshop starts with the **Mudskipper MK. I**, an eight-part machine using **23 of 30 salvage**. Choose **Enter arena → Start engines** to fight immediately, or select a library component to open the live editor. The VMD wordmark opens the cinematic title screen. Pip’s dossier and the field guide introduce the championship story.

- **Box build:** drag a part from the library directly onto the face you want (use its grip on touchscreens). Release a green preview to attach it. Tap a card for the face picker and confirm button instead.
- **Custom engineering:** adjust XYZ position, orientation, and dimensions. Drag along a face with optional quarter-unit snapping. Turn off snapping to place the component exactly where you point. Red previews cannot be attached.
- **Edit an existing component:** select it in the viewport. Drag it to another face, or use its controls to move/resize, duplicate, or remove it. Direct dragging carries its attached children with it. Removing a mount also removes its children and releases their salvage.
- **Garage:** save named blueprints, restore them, or load the supplied factory configuration. Saving an existing name updates that blueprint.
- **Research:** open Garage → Upgrades & research. Coins permanently unlock rare components. Researched components still have a salvage cost.

## Controls

| Action                            | Control                              |
| --------------------------------- | ------------------------------------ |
| Accelerate / reverse              | W / S or up / down arrows            |
| Steer                             | A / D or left / right arrows         |
| Fire ready weapons                | Hold F, left mouse, or Fire weapons  |
| Hop / rotor lift / thruster boost | Space or Action                      |
| Orbit / zoom                      | Drag the background / wheel or pinch |
| Follow-camera reset in the arena  | C or the focus button                |
| Pause                             | Escape                               |
| Rotate / confirm preview          | R / Enter                            |
| Duplicate / remove selection      | Ctrl/Cmd+D / Delete                  |
| Undo / redo                       | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z        |
| Save blueprint                    | Ctrl/Cmd+S                           |

The arena has on-screen driving, action, and firing controls. Switching browser tabs pauses the match. Losing window focus releases any held controls. Audio begins only after a user gesture; effects and crowd volumes are independent. When enabled, recorded MP3 commentary follows the match events and round clock; countdowns use the visual count and game sound effects.

## Advanced engineering (expanded)

The workshop catalog now contains **90 modular components** across Structure, Mobility, Weapons, Mechanical, and Power. Definitions live in `src/game/expansion.ts` with shared material profiles in `src/game/data.ts`, so new components do not require engine changes.

- **20 material behaviors.** Wood, cardboard, stone, iron, steel, titanium, copper, brass, carbon, ceramic, composites, rubber, foam, polymer, and experimental alloy differ in density, hardness, elasticity, friction, and resistance to cut, impact, blunt, pierce, and explosive damage.
- **29 weapons.** Rotating cutters, projectile launchers, spring punches, hammers, presses, and pendulum systems each choose their behavior, delivery, damage type, shots, energy use, recoil, and range from data.
- **Mechanical mechanisms.** Axles change grip, bearings reduce cycle times, gearboxes trade speed for impact, motors add drive, pistons and hydraulics increase impulse, brackets distribute shock, platforms permit swivel aim, jumpers launch, and stabilizers supply a limited righting force.
- **Power architecture.** Batteries add independent capacity, generators restore it, and wiring, switches, controllers, and breakers add efficiency while intact. Weapons need enough shared EP to fire. The arena reports capacity, regeneration, and slick-surface status; press **1** and **2** or use the WPN/DRV switches to isolate systems.
- **Progressive failure.** Condition affects wheel tractability and wobble, rotor lift and stability, weapon jam probability and cycle time, and mount load. Failure of a mount releases unsupported children as independent physical bodies. Detached wheels keep mass and angular momentum; broken rotors shed three physical blades.
- **Engineering analysis.** Analyze opens mass, centre of gravity, front/rear and left/right load, structural integrity, armour, mobility, weapons, flight, capacity, generation, and demand. Components and materials tabs expose per-part properties. Centre-of-mass and structural-connection overlays can be toggled directly over the live assembly.

## Replay video export

Open any match from **Garage → Replays** (or **Watch replay** on the result screen) and use **Download MP4**:

- Choose **480p, 720p or 1080p**. Slow motion around component failures is optional.
- The replay is rendered offline, frame by frame, at a fixed 30 fps with interpolation between the recorded physics snapshots. The output is smooth however fast the device draws.
- Frames are encoded as **H.264** with the browser's WebCodecs encoder and muxed into a standard `.mp4` (fast-start). Each frame includes an overlay with the round, both engineers, the clock, a failure ticker and the final result.
- Export runs entirely on the device, shows progress with a time estimate, and can be cancelled. It requires a browser with WebCodecs (recent Chrome, Edge, Safari or Firefox).
- Files are named like `vmd-round01-pip-vs-rivet-20261120.mp4`.

## Game systems

- **29 selectable components** plus the central chassis, with independent HP, mass, material properties, build costs, energy use, and weapon cooldowns.
- **Two engineers per match.** A 100-round campaign introduces different rival vehicles, close-range and standoff strategies, aerial builds, component targeting, and advanced weapons.
- **Fixed-step 60 Hz physics.** A compound rigid body holds attached components, with weight distribution, wheel contact springs, lateral grip, recoil, lift, and impact damage. A destroyed attachment becomes a separate colliding body. Armor distributes impacts away from the chassis.
- **Ten weapon behaviors:** rotary saw, egg launcher, pillow thrower, spring catapult, hammer, swing arm, arc railgun, impact pod, twin blades, and nova pulse. Arc pulses use physical ray tests, and thrown objects use colliding rigid bodies.
- **Win condition:** destroy the rival’s chassis, or finish the 150-second round with the higher remaining health percentage. Damage affects only the match instance, never the saved blueprint.
- **Rewards:** victories award salvage, coins, and experience. A first victory advances the circuit. Milestone victories unlock research. Defeats preserve the machine and award participation experience.
- **Performance:** shared geometry/materials, batched static meshes, instanced treads and spectators, distant low-detail models, reusable projectiles, pooled particle buffers, adaptive resolution, configurable shadows, and lazy-loaded 3D code. A projected software view is available if WebGL cannot initialize.

## Persistence

The current profile is saved to `localStorage` under `vmd.engineer.v1`. A random per-device key authorizes a private PostgreSQL backup through `/api/save`. The newest valid local or remote state is restored at startup. The server rejects stale writes. The local leaderboard maintains permanent career totals and best scores, grouped by the engineer callsign used for each match. The recent match log retains 500 battles without discarding career records.

Database configuration uses `DATABASE_URL` from `.env.local` and `src/db/index.ts`. Drizzle uses that same URL through `drizzle.config.ts`; the `vmd_engineer_saves` table is defined in `src/db/schema.ts`. Run `npx drizzle-kit push` to create the table in the configured database.

