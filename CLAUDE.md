# Minefall

Real-time 2-player online game: a 7 × 6 gravity grid where you win by aligning 4 tokens,
plus **hidden mines** each player places secretly before the match. Portfolio project:
code quality, structure, tests and README matter as much as features.

Full specification: [docs/SPEC.md](docs/SPEC.md). Read it before any non-trivial change.

> Naming: the product is **Minefall**. Never use the name "Connect Four" in code, UI,
> comments, package names or docs we write (the spec's title is the only exception).

## Stack

| Layer                      | Choice                                                                            |
| -------------------------- | --------------------------------------------------------------------------------- |
| Monorepo                   | pnpm workspaces                                                                   |
| Front end (`apps/web`)     | Vue 3 + TypeScript + Vite + Pinia + Tailwind CSS (CSS transitions, GSAP optional) |
| Back end (`apps/api`)      | NestJS + Socket.IO gateway (namespace `/game`)                                    |
| Shared (`packages/shared`) | Types, event names, payload types, pure game engine                               |
| Database                   | PostgreSQL + Prisma (users, finished games, mines, moves)                         |
| Live game state            | In-memory `Map` per room (Redis in V2)                                            |
| Auth                       | Guest token (nickname only); JWT accounts in V2                                   |
| Tests                      | Vitest (engine), Jest/Supertest (API), Playwright (2-tab E2E)                     |
| Tooling                    | Strict TypeScript, ESLint + Prettier                                              |
| Deploy                     | Docker Compose on a VPS behind Nginx (HTTPS, WS upgrade), GitHub Actions CI       |

**Any library not listed in SPEC section 2 requires the user's approval first.**

## Folder structure (target)

```
minefall/
├─ apps/
│  ├─ api/            NestJS + Socket.IO gateway, Prisma, rooms, timers
│  └─ web/            Vue 3 client (screens, Pinia stores, board rendering)
├─ packages/
│  └─ shared/         @minefall/shared
│     └─ src/
│        ├─ engine/   pure game engine (no I/O, no sockets, no timers)
│        ├─ types/    state, payload and view types
│        └─ events.ts event name constants
├─ docs/SPEC.md
├─ CLAUDE.md
├─ pnpm-workspace.yaml
└─ package.json
```

## Commands

Run from the repo root. Requires Node ≥ 22 and pnpm 10 (`npm i -g pnpm@10`).
TypeScript is pinned to 6.0.x because typescript-eslint does not support TS 7 yet.

```bash
pnpm install                          # install all workspaces
pnpm test                             # run all tests
pnpm --filter @minefall/shared test   # engine tests only
pnpm --filter @minefall/shared test:coverage
pnpm lint                             # ESLint across workspaces
pnpm format                           # Prettier write
pnpm typecheck                        # tsc --noEmit across workspaces
```

Commands for `apps/api` and `apps/web` are added when those milestones start.

## Architecture rules (SPEC section 6 & 10 — non-negotiable)

1. **The server is the only authority.** Clients send intentions (`move:drop { column, turnId }`);
   the server validates, applies the rules, resolves mines and broadcasts results.
   Clients never compute the outcome of a move and always render from server state.
2. **The engine is pure TypeScript**, framework-free, in `packages/shared/src/engine`:
   `applyMove(state, playerId, column) → { state, events }`. No sockets, no timers, no
   `Date.now()` / `Math.random()` inside — time and randomness are injected.
   The gateway only calls the engine.
3. **Never send an opponent's unexploded mines to a client.** Every emit goes through
   `toPlayerView(state, playerId)`. A unit test asserts no payload for player A contains
   player B's unexploded mines.
4. **Event names and payload types live in `packages/shared`** and are imported on both
   sides. No string literals for events in components or gateways.
5. Every client → server event is acknowledged: `{ ok: true } | { ok: false, error: code }`.
   Invalid moves return an error ack and change nothing.
6. Timers run on the server; clients only display countdowns from `endsAt` timestamps.
7. Chat text is sanitised (no HTML) and rate-limited per socket. Room codes are random
   and non-sequential; tokens are verified on every socket connection.

## Working rules (SPEC section 10)

- Build **milestone by milestone** (SPEC section 9). Do not start the next milestone until
  the current one runs and its tests pass.
- Write the engine first, with tests, before any socket code. Target ≥ 90 % engine coverage.
- Prefer small, readable files; explain each new module in 2–3 lines before writing it.
- The user is new to NestJS (strong in Laravel + Vue 3 + TS): briefly explain NestJS
  concepts when introduced, comparing to Laravel where useful.
- Ask before adding any library not in SPEC section 2.
- When a rule is ambiguous, follow SPEC section 3 and **ask** — never invent a rule.
- Strict TypeScript, no `any` in the shared package.
- At the end of each milestone report: what was built, how to run it, how to test it,
  what's next, plus a suggested git commit message.

## Game rules — quick reference (SPEC section 3)

- Grid 7 cols × 6 rows. Player 1 = red, Player 2 = yellow; starting player by dice roll.
- **Placement (30 s):** each player picks 2 mine cells, any row except the top row.
  Same cell allowed for both players. Missing mines placed randomly on timeout.
- **Play (20 s/turn):** choose a column not full and not blocked; token falls to lowest
  empty cell.
  - Own mine → nothing happens, token stays.
  - Opponent mine → explodes, revealed to both, token destroyed, cell stays empty,
    mine removed, column blocked for both players.
  - Turn always passes (explosion uses the turn). Timeout → server plays a random valid column.
- **End:** 4 in a row (H, V, both diagonals) wins; draw if the next player has no valid
  column (board full or all free columns blocked); forfeit on leave or > 60 s disconnected.
  All remaining mines revealed at the end.

## Decided rule choices

Answers to the open questions in SPEC section 3. These override any guess.

- Blocked column duration: **1 turn**: only the very next move (the opponent's) cannot
  use the column. (decided 2026-11-25)
- Explosion also destroys the token below: **not implemented** (possible later option).
  (decided 2026-11-25)
- Turn timer: **as in the spec**: 20 s per turn; on timeout the server plays a random
  valid column. (decided 2026-11-25)
- No valid column for the next player (board full, or every free column blocked):
  **the game ends as a draw** immediately after the move that caused it. (decided 2026-11-25)
- Starting player: **dice roll** instead of a plain random pick. Each player rolls **two**
  six-sided dice; the highest total becomes Player 1 (red) and moves first; equal totals
  re-roll. The server rolls, the client only animates the rounds. Rematch still swaps the
  starting player (F10). (decided 2026-11-25)
- Same cell mined by both players: **it explodes** when either player lands on it (the
  opponent's mine wins over own-mine safety). The token is destroyed and both mines are
  removed and revealed. (decided 2026-11-25)
