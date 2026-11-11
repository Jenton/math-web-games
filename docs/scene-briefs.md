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
