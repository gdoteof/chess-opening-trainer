# Opening Trainer

A browser chess trainer for beginners, with two modes:

- **Openings.** Pick a named opening (and its sub-variations). The app plays the other side from
  the book and works through every line: after each line it starts the next, steering toward lines
  you haven't finished yet. There are two ways to practise, each with its own progress:
  - **Learn**: arrows show the book moves, and the panel names the opening each one leads to.
  - **Drill**: find the book moves yourself. A line counts only if you play it without a wrong move.

  Each opening is marked as White's or Black's, and choosing it gives you that side (you can
  switch to practise against it). While choosing, you can filter the list by side, and play book
  moves on the board to narrow it to openings that reach that position, by any move order.
- **Play the bot.** Play Stockfish at a rating from about 400 to 2800, or at full strength.

Right-click and drag on the board to draw arrows while you think, or right-click a square to mark
it (hold Shift, Ctrl or Alt for other colors). In both modes, when you pick up a piece its legal destinations are colored by how good each move
is (green, yellow, orange, red). If you play a mistake or a blunder, the game pauses and the
board plays out the engine's refutation so you can see *why* it was bad. Then you can take it back
and try again.

Everything runs in the browser: the opening book is bundled, and Stockfish runs as WebAssembly in
a Web Worker. There is no backend.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, with the headers the multi-threaded engine needs |
| `npm test` | Unit and store-flow tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` / `npm run preview` | Production build into `dist/`, and a local server for it |

## How it works

```
src/
  config.ts      every tunable number: quality thresholds, search depth/time, bot, proof
  domain/        pure chess logic, no I/O, unit tested
    book.ts        opening index: book moves and names per position, opening trees
    practice.ts    which lines a practice has finished, and the book side's steering
    quality.ts     centipawn loss → green / yellow / orange / red
    bot.ts         rating → sampling temperature, move choice
    proof.ts       when a refutation has made its point, and how to label it
  engine/        Stockfish: UCI parsing, Web Worker transport, queued cancellable service
  store/         Redux Toolkit
    *Slice.ts      settings, engine (status + analysis cache), openings, bot, game
    effects.ts     listener middleware: engine scheduling, opponent replies, judging, proofs
    thunks.ts      user intents (play a move, start a line or game, switch mode)
  components/    React UI
  data/          bundled lichess-org/chess-openings TSVs
```

State lives in Redux Toolkit slices. Side effects are listener-middleware effects in
`store/effects.ts`, which receive the engine and the opening book as injected services, so the
whole game flow can be tested against a scripted fake engine (`store/flows.test.ts`).

**One engine, always at full strength.** Bot weakness never comes from Stockfish's own strength
settings. Every position is searched with MultiPV set to the number of legal moves, so every
legal move gets a score and a principal variation. The bot samples from those moves with
probability ∝ exp(−loss / T), where T falls as the rating rises (`domain/bot.ts`, meant to be
tuned by feel). A single scheduler decides what the engine works on, in priority order: extending
a blunder proof, judging the move you just played, the bot's move, then your position for hints.
It cancels the running search whenever that target changes. Results are cached by position.

**Engine build.** On a cross-origin-isolated page (the dev and preview servers send
`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`) the
multi-threaded build loads; otherwise the single-threaded one does. The console logs which.
Any static host you deploy to must send the same two headers to get threads.

The default is Stockfish's *lite* network (about 2 MB). It is far stronger than any human and
loads instantly. Set `engine.flavor` to `'full'` in `src/config.ts` for the full network (about 95 MB).

### Choices beyond the original spec

- **Decisive positions.** Scores are clamped to ±10 pawns (`quality.evalCapCp`) before losses are
  computed. Without the clamp, going from +15 to +11 would count as a blunder. Allowing a forced
  mate is still always red. Set the cap to `Infinity` for raw centipawn losses.
- **Recaptures in proofs.** A material drop only ends a proof once your next move fails to win it
  back. Otherwise the first half of an even trade would be labeled "loses material".
- **Draws.** A proof that ends in stalemate or another draw is labeled "Allows a draw".
- **Rated bots** move once the search reaches depth 14 instead of waiting out the full 3-second
  budget; the "Max" bot always waits for the full search.
- **Keep my move.** In bot mode, after a proof you can keep the move and play on, as well as take it back.
- **White's or Black's.** The dataset doesn't say which side an opening belongs to. The app gives
  it to whoever played the last move of its shortest line, unless the name ends in "Defense"
  (Black) or "Attack" (White), because some lines run a move past the one that names them. It is
  right for the well-known openings; a few, like the Four Knights Game, are really for both.

## Data and licenses

- Opening names and lines: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings),
  CC0. Refresh the bundled copy with `scripts/fetch-openings.sh`.
- Engine: [Stockfish.js](https://github.com/nmrugg/stockfish.js) (the `stockfish` npm package),
  GPLv3. It is served unmodified as a separate program in a Web Worker, and this app talks to it
  over UCI.
- This repository does not have a license yet.

## Roadmap

Accounts with saved progress, and premium features behind a paywall. The architecture is ready for
both:

- Every slice is plain serializable data, so practice progress can be persisted or synced without
  reshaping the state.
- A backend client would be one more injected service next to the engine and the book (likely RTK
  Query), and entitlements would be another slice that components and effects check.
