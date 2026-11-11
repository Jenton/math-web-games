# Animation & Motion Guide for Math Quest

Working rules for making our games feel alive and polished. Written for this codebase
(plain DOM + CSS + JS; Munchers, Balance, Machine Builder and Creature Quest, drawn with emoji and the Kenney CC0 art described in `docs/kenney-asset-plan.md`), and for a
young audience: motion should **explain** what just happened, never just decorate.

> **How to read the numbers.** Durations and frame counts below are starting points
> collected from game-dev and animation write-ups (see Sources) plus common UI practice.
> They are conventions, not standards. Tune each one by playing it. Where a number comes
> from our own judgment rather than a source, it says "our call".

---

## 1. The three-question test

Before adding any animation, it must answer at least one of:

1. **What just happened?** (feedback: "that munch worked", "that was wrong")
2. **What can I do / what is about to happen?** (anticipation: "that monster is about to move")
3. **Where did it go / where did it come from?** (continuity: things slide, they don't teleport)

If it answers none, it is decoration: keep it tiny or cut it. In a math game, motion must
never hide the math. Numbers stay readable and still while the player decides.

---

## 2. The principles that matter most (and how to use them here)

The classic 12 principles come from hand-drawn film. For a small 2-D web game, these
seven do most of the work.

### Anticipation: a small wind-up before the action
- A character/enemy does a tiny opposite move *before* the real move, so the player can see it coming.
- **Games differ from film:** in film, anticipation is always welcome. In a game, a long wind-up
  on the *player's* action feels laggy. So:
  - **Player actions:** instant response, wind-up ≤ ~60 ms or none. Put the flourish in the follow-through instead.
  - **Enemy actions:** a real wind-up (150–400 ms) is *good*. It is fair warning and it looks alive.
- **Our use:** a Munchers glitch crouches (squash down + tiny lean toward its next cell) ~250 ms
  *before* it hops. Gives kids time to react, and kills the "teleporting monster" feel.

### Squash & stretch: weight and speed
- Stretch along the direction of travel when fast, squash on impact or when slowing. Keep the
  object's apparent **volume constant**: if it gets 20 % wider it gets ~15–20 % shorter.
- Subtle is better. Typical range: `scale(1.15, 0.85)` squash, `scale(0.9, 1.15)` stretch.
  Past ~±30 % it reads as rubber, not cute.
- **Our use:** player hop = stretch up on launch, squash on landing (~80 ms), settle back.
  Balance blocks squash slightly when they land on the beam. Number cells squash when munched.

### Timing & spacing: easing is the "weight"
- Things speed up leaving a spot and slow down arriving. Never use `linear` for movement.
- **Default curves (CSS):**
  - Entering / arriving: `cubic-bezier(.2, .8, .2, 1)` ("ease-out", decelerates)
  - Leaving: `cubic-bezier(.4, 0, 1, 1)` ("ease-in", accelerates)
  - Playful overshoot (bounce-in, scale pop): `cubic-bezier(.3, 1.4, .5, 1)` (already used on the Balance beam)
- **Duration ladder (our call):**

| What | Duration |
|------|----------|
| Press / tap feedback | 60–100 ms |
| Small state change (chip selected, cell highlight) | 120–180 ms |
| Moves across the board, panels opening | 200–300 ms |
| Big transitions (level cleared, screen to screen) | 300–500 ms |
| Anything the player must wait on | never over ~600 ms without a skip |

### Follow-through & overlapping action
- Parts don't all stop at once. After the main move lands, secondary parts (a tail, a number
  badge, a shadow) settle 1–3 frames later. In CSS: give the secondary element the same
  animation with an `animation-delay` of 40–80 ms.
- **Our use:** when a board is cleared, stars/confetti burst *after* the last cell pops, not with it.

### Staging & silhouette
- One main thing moves at a time. Everything else is calm. The eye follows motion; if five
  things wiggle, the important one is lost.
- Keep silhouettes readable. If a pose or smear changes the outline too much, it stops
  looking like the same character.
- **Our use:** idle motion (breathing, blinking) only on the *player* and enemies; **never** on number cells.

### Secondary action & idle life
- Tiny looping motion when nothing is happening (a 2-px bob every 1.2–2 s, a blink every
  3–5 s at random) makes a screen feel alive instead of frozen.
- Keep idle loops slow and low amplitude, and **pause them while the player is deciding on a
  rule explanation**, so they never compete with reading.

### Appeal & exaggeration (use sparingly)
- Clear, simple, slightly exaggerated beats realistic. For feedback moments (correct, wrong,
  level up) exaggerate a little; for everyday movement, stay subtle.

---

## 3. Game feel ("juice"): feedback on key events

Juice = layered small feedback on important events: flash, shake, pause, particles, sound.
Layer a few, scaled to how important the event is. Starting tiers:

| Event | Suggested feedback |
|-------|-------------------|
| Correct munch / correct answer | pop (scale 1→1.2→1, ~150 ms), small number or ✓ floats up and fades (~500 ms), tiny particles |
| Wrong munch | gentle horizontal shake of the cell/board (**2–3 px**, 150–250 ms), colour pulse; the explanation panel follows. **Never** harsh or punishing for kids. |
| Glitch touches player | 2–4 frames of **hit pause** (~30–70 ms freeze) + flash + player bump back |
| Level / puzzle cleared | bigger burst: 400–800 ms confetti or stars, slight board "bounce", then panel |
| Machine Builder: op applied | the number rolls/pops to its new value (~200 ms), the chain line slides in |
| Balance: scale settles level | small overshoot bounce, then the beam glows green (already partly built) |

**Hit pause (hit stop):** freeze motion for a few frames at the moment of impact. Sources
suggest roughly 2–4 frames for light hits and 5–10 for heavy ones. For us, keep it to the
*light* end. Freeze **only gameplay movement**, not the UI, so panels stay responsive.

**Screen shake:** define 2–3 named tiers (e.g. light / medium) rather than ad-hoc numbers;
apply to the visual layer (CSS transform on the board), never to the game logic. Sources
suggest ~3 px for ordinary hits. Always honour the reduce-motion setting (section 6).

**Restraint:** every effect fires on *every* occurrence, so a 30-times-a-minute effect must be
very small. Save big effects for rare moments.

---

## 4. Pixel art and sprite specifics (for Kenney sprites and any future hand-made art)

- **Frame rate:** pixel-art animation usually runs at ~8–12 fps ("on twos"), not 60. Smooth
  60 fps *movement* of a sprite across the screen is fine; the *drawn frames* inside it step at 8–12.
- **Fewer frames, better timing.** More frames are a trap: each one is hand-placed pixels to
  keep consistent. Timing matters more: **hold key poses longer, move fast between them.**
  Example from the sources: a ~300 ms hold on the impact frame with ~80 ms wind-up frames.
- **Easing comes from timing, not spacing.** You can't move half a pixel, so make a move feel
  eased by spending more frames near the start and end, fewer in the middle.
- **Smear frames:** for very fast moves, one frame where the sprite is stretched/blurred along
  the motion makes it read as fast. Use **one** frame, sparingly, and protect the silhouette.
- **Sub-pixel animation:** to suggest movement smaller than one pixel (breathing, blinking,
  a slight sway), shift colours between neighbouring pixels instead of moving shapes.
- **Keep an anchor point.** Pick a consistent pivot (usually feet-center) so squash/stretch and
  idle bobs don't make the character drift between frames.
- **Crisp rendering.** For scaled pixel art use `image-rendering: pixelated` and scale by
  whole numbers (2×, 3×), or pixels go blurry/uneven.
- **Sprite sheets in CSS (technical note from general web practice, not from the sources above):**
  one image with frames side by side, shown through a fixed-size box, stepping the
  `background-position` with `animation-timing-function: steps(N)`. `steps()` gives the
  frame-by-frame look that smooth easing would ruin.

---

## 5. Performance & technical rules (CSS/DOM)

- **Animate `transform` and `opacity` only.** They are cheap (GPU-friendly). Don't animate
  `top/left/width/height/margin`: they force layout and stutter on phones.
- For movement across the grid, set position with `transform: translate(...)` plus a CSS
  `transition`, instead of re-rendering cells. Our board already updates in place; keep it that way.
- Use CSS transitions/keyframes for small effects; use `requestAnimationFrame` only for
  things that need per-frame logic (particles, shake decay).
- Prefer `will-change: transform` only on things that animate constantly; remove it otherwise.
- **Never let an animation block input.** Tapping during a pop or hop must still register
  (we already apply taps in place; keep that invariant). If a move is mid-animation, either
  queue the next tap or let it retarget smoothly.
- Don't tie game rules to animation timing (e.g. "monster moves when animation ends"):
  rules run on the game clock, animation just *displays* them, so a slow device can't change the game.
- Pause everything when the tab is hidden (we already skip ticks when `document.hidden`).

---

## 6. Accessibility, calm mode, and age-appropriateness

This is a kids' learning app, so accessibility is part of "polished".

- **Honour `prefers-reduced-motion: reduce`.** When set: no shake, no hit pause, no bouncy
  overshoot, no parallax or constant idle loops. **Keep** short fades and colour changes, since they
  still communicate. Don't just delete the animation: make sure the final state is visible
  (`opacity: 1; transform: none`), or elements can get stuck at their start keyframe.
- **Ship our own switch too.** Add a profile option ("Calm motion") next to the existing "Calm"
  glitches option. A child on a device that doesn't expose the OS setting may still need it.
- **No flashing.** Never flash large areas more than 3 times per second. Prefer colour *pulses*
  to white strobes. Hit-flash should be small (the sprite, not the screen).
- **Wrong answers are teaching moments:** use gentle, short, non-startling motion (a soft wobble),
  never a loud shake or red flash, and never block with a long animation.
- **Respect reading time.** No motion near the rule text or explanation while the player reads.
- **Don't carry meaning in motion alone.** Pair with colour/shape/text for anyone who can't see or perceive it.

---

## 7. Where to apply it first (draft plan)

Ordered by "biggest polish for least risk". Each is a small, separate change.

1. **Shared motion tokens** (`--ease-out`, `--ease-in`, `--ease-bounce`, `--t-fast/med/slow`)
   in CSS, plus the reduced-motion override in one place. Everything below uses them.
2. **Munchers: player + glitch movement.** Smooth hop between cells (transform transition),
   squash/stretch, glitch wind-up before each step, idle bob.
3. **Munchers: munch feedback.** Pop + float-up ✓ on correct, soft wobble on wrong, hit-pause + bump when a glitch touches you.
4. **Level cleared / puzzle solved** celebration, scaled by whether it was a clean run.
5. **Balance:** blocks drop in with a squash, beam overshoot (exists), number tick when changing `?`.
6. **Machine Builder:** number roll on each op, chain items slide in, star reveal at the end.
7. **Screen-to-screen transitions** (menu → setup → game): short (≤ 250 ms) slide/fade.
8. **Creature Quest:** turn-based combat has the most to gain: attacker lunge (anticipation then strike), hit flash + short hit pause on the target, damage numbers floating up, and a clear "whose turn" idle bob. Another chat owns this game's art, so coordinate before touching its files.
9. **Calm-motion setting** wired to everything above.

---

## Sources

Used for the principles, timing ranges and caveats above:

- [12 principles of animation (cxong.github.io)](https://cxong.github.io/2023/03/12-principles-of-animation)
- [The 12 principles of animation in video games (Game Developer)](https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games)
- [The 12 Principles of Animation, Reframed for Games (anim.works)](https://anim.works/?p=23056)
- [Pixelblog 8: Intro to Animation (Slynyrd)](https://slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation)
- [Pixel Art Sub-Pixel Animation (Tiny Warrior Games)](https://tinywarriorgames.com/2019/01/04/game-development-pixel-art-sub-pixel-animation/)
- [5 tips for making great animations for 2D games (Game Developer)](https://gamedeveloper.com/art/5-tips-for-making-great-animations-for-2d-games)
- [Why 90-year-old animation theory still matters for pixel art (sprite-ai)](https://www.sprite-ai.art/guides/animation-principles)
- [Smear frames: the one-frame "cheat" (Prolific Studio)](https://prolificstudio.co/blog/smear-frames/)
- [Where does game feel come from (eastondev)](https://eastondev.com/blog/en/posts/dev/20260521-game-feedback-feel/)
- [Godot Hitstop basics (uhiyama-lab)](https://uhiyama-lab.com/en/notes/godot/hit-feedback-hitstop/)
- [Game juice checklist: 30 techniques (gamejuice)](https://gamejuice.pages.dev/articles/game-juice-checklist-30-techniques)
- [Camera shake without motion sickness (StraySpark)](https://www.strayspark.studio/blog/camera-shake-game-feel-without-motion-sickness)
- [@keyframes and prefers-reduced-motion done right (Flavio Copes)](https://flaviocopes.com/css-keyframes-reduced-motion/)
- [Reduced Motion Guide (Verdigris)](https://design.verdigris.co/categories/animation/reduced-motion)
- [prefers-reduced-motion accessible animation (OpenReplay)](https://blog.openreplay.com/prefers-reduced-motion-accessible-animation/)

**Caveats:** many of these are blogs and tool-vendor pages rather than authoritative references; the
numbers (8–12 fps, 2–10 hit-pause frames, 3 px shake) are rules of thumb. The `steps()` sprite-sheet note
and the "animate only transform/opacity" rule are general web practice I'm adding, not claims from those sources.
The duration ladder in section 2 and the event table in section 3 are our own starting values to tune by playtest.
