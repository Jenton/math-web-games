# Scene briefs

One brief per game, in the five-line shape `docs/new-game-checklist.md` asks for. Written for Sort & Rule and Cut & Share when they were brought up to the polish bar
(11 Nov 2026); add new games here.

## Sort & Rule: the castle gate
1. **The place.** A stone gate in the middle of the screen with a guard in front of it. Numbers wait as wooden tiles below. Tiles that pass land in a green
   "let through" yard on the left; tiles that are stopped land in a pale-red "stopped" yard on the right. Art: Tiny Dungeon (door `t46`, open archway `t10`, wall `t28`,
   knight `t96`), Kenney tile frames (Wood, Yellow, Metal), emotes.
2. **Things that move.** The door, the guard's emote, and each number tile that travels to a lane. *Today these are static state swaps (door closed or open, emote shown);
   the motion is the next pass, see `docs/animation-guide.md`, "Sort & Rule and Cut & Share: animation plan".*
3. **The path.** A tile leaves the tray, goes to the gate, then to one of the two yards. It never just appears.
4. **Feedback.** Right rule: medal and stars. Wrong rule: the hint names a number to test, or shows the arithmetic that contradicts the guess. Lose: the rule is revealed.
5. **Math is the mechanic.** Could a kid play well without the math? No: every test is a clue, and a guess is explained from the player's own tests.

## Cut & Share: the pizza party
1. **The place.** A wooden table with the pizzas above it and the friends (Kenney animals) sitting at it, each with a plate. Art: Animal Pack animals, the hand-drawn SVG pizza.
2. **Things that move.** Pizza slices, and each friend's plate. *Today the plates redraw to show one friend's share as you choose; the slices do not travel yet.*
3. **The path.** On "Share it!" the slices go from the pizzas to the plates, one friend at a time, so you see whether everyone is served.
4. **Feedback.** A plate always shows one friend's current share (S of c slices), never the totals. After sharing, the panel shows the arithmetic: slices used or missing.
   The win text is honest about stars: the fewest-cuts message no longer asks for fewer cuts when the cuts were already the fewest.
5. **Math is the mechanic.** Could a kid play well without the math? No: the plates show the fraction one friend gets, and fairness depends on the numbers.

## Arrow Range: the misty archery field (planned, not built; logic is in `js/archerylogic.js`)
Side view, per the owner (12 Nov 2026). Art chosen: smooth vector (item 5; the search results are under "Art" in `docs/game-ideas.md`).
1. **The place.** A side-on field at phone width (375 px): sky and hills behind; the archer at the left on a ground strip or a wooden platform; a **distance ruler** along the
   bottom of the field (tick marks, sparse labels, the tapped tick lights up); a **height ruler** down the left edge (only for rounds that have height); a wind flag on a pole (in the foreground grass below the ruler, only on wind shots, so it never reads as part of the number line);
   a tower or tree a fixed distance away for height shots; and a **mist bank** over the target area. The target stands somewhere in the mist and is never drawn at its real spot before the shot.
   The scout's note sits in a sign or scroll above the field. After the four aimed shots the scene changes to the **scoring board**: a big target with rings, each ring a tappable value, and three or four arrow slots.
2. **The things that move.** The archer (an idle breath and a bow draw when a tick is chosen), the wind flag (waves faster in stronger wind, still on a calm day), drifting mist,
   and a bobbing aim marker on the chosen tick. Every state has life: even while waiting, the flag and mist move.
3. **The path of the action.** Tap a tick (or two ticks, in height rounds) and the bow turns to the aim. Loose: the arrow flies in a **visual arc** from the bow to the landing spot,
   with the wind visibly nudging it in wind shots. The arc is `ARCH.arcPoints`, which always ends exactly on the chosen spot, so the math is never changed by the animation.
   On a hit the mist parts and the target is revealed in its real position (a miss never reveals it). Hop shots start from the last arrow, which stays stuck in the ground.
4. **The feedback moments.** Right: the arrow thunks into the target, a ring flash, the Bullseye line with the arithmetic ("6 × 7 = 42"). Wrong: the arrow sticks where it landed, the target stays hidden (revealing it would give the answer away on the retry)
   and the message counts the ticks ("1 tick short", "Right distance, but 2 ticks too low"; wind shots show target minus wind). Win: medals as in the other games, stars from wasted arrows.
   Sound only through `js/sfx.js`: fixed bow twang, a hit and a miss, and the result sound must not be masked by the flight sound. Reduce motion: the arc becomes a quick fade to the landing spot.
5. **The Kenney assets.** Smooth vector family only, all in `assets/kenney/archery/`: backdrop `sky`, `hills`, `hillsLarge`, `cloudLayer1`, `cloud1-3`, `tree`, `treeSmall_green1`, `bush1` (Background Elements Remastered); height rounds use `tower`, `towerSmall` or `castleWall` as the wall and `wood` (tiled) with `post` as the platform; the wind flag is `flagRed1`/`flagRed2` alternating for the wave and `flagRed_down` for a calm day; the scoring board and the hidden target use `target_colored`, `target_red1`, `target_red3`, `target_white` (Shooting Gallery); the archer is the Toon Characters `male_*` or `female_*` poses (idle, side, hold, attack0 to draw, attack1 to loose, cheer0 on a hit, hurt on a miss). **Draw as small original SVG:** the bow, the arrow, the quiver, the mist bank and the rulers (none exist in the bundle). No pixel-art tile in this scene.

**Could a kid play well without the math?** No. The target is hidden, the ruler labels are sparse (the tests check that most targets sit on unlabeled ticks), the note is in a different form from the ruler
(fractions on a decimal ruler, expressions, percents), a miss costs a star, and the scoring board has a single exact total that most ring combinations miss.

