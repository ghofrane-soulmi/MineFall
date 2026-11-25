Mined Connect Four — Cahier des charges
1. Project overview

Mined Connect Four is a real-time, 2-player online game: classic Connect Four (7 columns × 6 rows, tokens fall with gravity, 4 in a row wins) plus hidden mines that each player places secretly before the match.

Purpose: a portfolio project that shows real-time engineering skills — WebSockets, server-authoritative game state, hidden information, reconnection handling and live chat — in an app a recruiter can try in under 30 seconds.

Target users:

Recruiters and developers visiting the portfolio (main audience): open the demo, play against a friend or the bot.
Casual players: two friends sharing a room link.

Success criteria:

A visitor can start a game without creating an account.
Two browser tabs can play a full game with no desync, page refresh included.
The opponent's mines are never visible in the client (not in the UI, not in the network traffic).
Deployed live with a public URL, a clean README and an architecture diagram.
2. Tech stack and architecture

The stack is TypeScript end to end: NestJS + Socket.IO on the server, Vue 3 on the client, with the game types shared between the two. This adds Node.js to a Laravel/Vue profile while keeping a front end the developer already masters.

Layer	Choice	Why
Front end	Vue 3 + TypeScript + Vite + Pinia	Known stack, fast to build the board UI
Styling / animation	Tailwind CSS + CSS transitions (or GSAP for the token drop)	Smooth falling and explosion effects
Back end	Node.js + NestJS (TypeScript)	Structured modules, guards, DI — close to Laravel's way of thinking
Real time	Socket.IO via NestJS WebSocket gateway	Rooms, acknowledgements, automatic reconnection
Database	PostgreSQL + Prisma	Users, finished games, move history
Live game state	In-memory Map for the MVP; Redis later	Fast reads; Redis allows several server instances
Auth	JWT for registered users; guest token (nickname only)	No sign-up needed to play
Shared code	packages/shared (monorepo: pnpm workspaces)	One source of truth for event names, payload types and game rules
Tests	Vitest (game engine), Jest/Supertest (API), Playwright (2-tab E2E)	The engine is pure logic and easy to test
Deployment	Docker Compose on a VPS (Nginx reverse proxy, HTTPS), front end on Vercel or same VPS	Persistent WebSocket server needs a real server, not serverless

Alternative: the same spec can be built with Laravel 11 + Reverb + Vue 3. Only this section and the event layer change; the rules, events and screens stay the same.

Architecture principle: the server is the only authority. Clients send intentions ("drop in column 3"); the server validates, applies the rules, resolves mines and broadcasts the result. Clients never compute the outcome of a move.

3. Game rules

A match is classic Connect Four on a 7 × 6 grid, with 2 hidden mines per player that destroy an opponent token landing on them.

Board and players

Grid: 7 columns × 6 rows. Player 1 = red, Player 2 = yellow.
Player 1 is chosen at random; then players alternate turns.

Phase 1 — Mine placement (30 s)

Each player secretly selects 2 cells as mines, on any row except the top row.
A player cannot see the opponent's mines. Both players may place a mine on the same cell (it then counts as a mine for both).
If the timer ends, the server places the missing mines at random.
The game starts when both players confirm or the timer ends.

Phase 2 — Play (20 s per turn)

The current player picks a column that is not full and not blocked.
The token falls to the lowest empty cell of that column (gravity).
Landing on your own mine: nothing happens (your mines never hurt you).
Landing on an opponent's mine: the mine explodes and is revealed to both players. The token is destroyed, the cell stays empty, the mine is removed, and that column is blocked for the next turn (for both players).
A token landing on an empty, mine-free cell stays there.
The turn passes to the other player in every case (an explosion still uses the turn).
If the turn timer ends, the server plays a random valid column for that player.

End of game

Win: 4 tokens of the same colour in a row — horizontal, vertical or diagonal. The winning line is highlighted.
Draw: the board is full, or no valid column remains for the current player and the next one.
Forfeit: a player leaves, or stays disconnected for more than 60 s.
At the end, all remaining mines are revealed.

Open rule choices (to decide before coding):

Should a column blocked by an explosion stay blocked for 1 turn or 2?
Option for later: an explosion also destroys the token directly below (more chaos, more fun).
4. Functional requirements

The MVP covers guest play, private rooms, the full game loop, quick chat, rematch and reconnection; accounts and stats come after.

ID	Feature	Description	Priority
F1	Guest access	Enter a nickname (3–16 chars) and receive a guest token. No email needed.	MVP
F2	Create room	Creates a private room with a 6-character code and a shareable link. Creator = host.	MVP
F3	Join room	Join by code or link. Max 2 players; extra visitors get "room full" (spectators later).	MVP
F4	Lobby	Both players shown with online status and a Ready button. Game starts when both are ready.	MVP
F5	Mine placement	Phase 1 rules (section 3), own mines shown with a marker, countdown visible.	MVP
F6	Play turns	Phase 2 rules: column hover preview, drop animation, turn indicator, turn timer.	MVP
F7	Explosions	Explosion animation, mine revealed, blocked column shown greyed with a counter.	MVP
F8	End screen	Winner / draw, winning line highlighted, all mines revealed, game duration and move count.	MVP
F9	Quick chat	6 preset messages ("GG", "Nice move!", "Oops", "Good luck", "Hurry up!", "Rematch?") + emoji reactions + free text up to 120 chars. Rate limit: 1 message / second.	MVP
F10	Rematch	Both click Rematch → new game in the same room, starting player swapped.	MVP
F11	Reconnection	Refreshing or a short disconnect restores the exact game state. Opponent sees "disconnected, waiting 60 s".	MVP
F12	Leave / forfeit	Leaving during a game = forfeit, opponent wins.	MVP
F13	Play vs bot	Simple AI opponent (random valid move, then a smarter heuristic) so one visitor can try the game alone.	V2 — high value for demo
F14	Quick match	Public queue that pairs two waiting players.	V2
F15	Accounts	Register / login (email + password, JWT), keep the guest nickname.	V2
F16	Profile and stats	Games played, wins, losses, mines triggered, history list with replays.	V2
F17	Replay	Step through a finished game move by move from stored history.	V2
F18	Spectator mode	Watch a room live without seeing either player's mines.	V2
F19	Sound and settings	Drop / explosion sounds, mute toggle, dark mode.	V2
5. Real-time events

All game traffic goes through one Socket.IO namespace /game; every client → server event gets an acknowledgement { ok: true } | { ok: false, error: code }. Event names and payload types live in packages/shared.

Client → server

Event	Payload	Server checks
room:create	{}	Valid guest/JWT token
room:join	{ code }	Room exists, not full
room:ready	{ ready: boolean }	Player is in the room, phase = lobby
mines:place	{ cells: [{col,row}, {col,row}] }	Phase = placement, exactly 2 distinct cells, not top row
move:drop	{ column, turnId }	Phase = playing, player's turn, column valid / not full / not blocked, turnId matches (prevents double clicks)
chat:send	{ type: 'preset' | 'emoji' | 'text', value }	Rate limit, length ≤ 120, preset id exists, text sanitised
game:rematch	{}	Phase = finished
room:leave	{}	—

Server → client

Event	Payload	Sent to
room:state	Full public room state + the receiving player's own mines	One player (on join / reconnect)
room:players	Players, online status, ready flags	Room
phase:changed	{ phase, endsAt }	Room
mines:confirmed	{ playerId } (no positions)	Room
move:result	{ playerId, column, landedRow, outcome: 'placed' | 'exploded', blockedColumn?, nextPlayerId, turnEndsAt, turnId }	Room
game:over	{ result: 'win' | 'draw' | 'forfeit', winnerId?, winningLine?, allMines }	Room
chat:message	{ id, playerId, type, value, sentAt }	Room
player:disconnected / player:reconnected	{ playerId, graceEndsAt? }	Room
error	{ code, message }	One player

Reconnection flow: on connect the client sends its token; if the player has an active room, the server re-joins the socket to it and emits room:state. Timers are server-side (endsAt timestamps), so a refresh never resets them.

6. Data model and server authority

Live games stay in server memory; only finished games and users are written to PostgreSQL.

Database tables (PostgreSQL)

Table	Main columns
users	id, nickname, email (nullable for guests), password_hash (nullable), is_guest, created_at
games	id, room_code, player1_id, player2_id, winner_id (nullable), result (win / draw / forfeit), started_at, ended_at
game_mines	id, game_id, owner_id, col, row, exploded (bool), exploded_at_move (nullable)
game_moves	id, game_id, move_number, player_id, column, landed_row, outcome (placed / exploded / timeout), created_at
chat_messages (optional)	id, game_id, player_id, type, value, created_at

In-memory game state (per room)

roomCode, phase ('lobby' | 'placement' | 'playing' | 'finished'),
players[2] { id, nickname, color, socketId, online, ready },
board: (null | 'red' | 'yellow')[6][7],
mines: { [playerId]: {col,row}[] }   // NEVER sent to the other player
blockedColumns: { [col]: turnsLeft },
currentPlayerId, turnId, turnEndsAt, moveHistory[]

Server authority and anti-cheat rules

The game engine is a pure TypeScript module (applyMove(state, playerId, column) → newState + events) with no socket code inside; the gateway only calls it.
The server builds a per-player view before every emit: own mines included, opponent mines removed. A unit test must assert that no payload sent to player A contains player B's unexploded mines.
Every move is validated server-side (turn, phase, column, turnId); invalid moves return an error ack and change nothing.
Timers run on the server; the client only displays the countdown from endsAt.
Chat text is sanitised (no HTML) and rate-limited per socket.
Room codes are random and non-sequential; tokens are verified on every socket connection.
7. Screens and animations

Five screens, responsive from 360 px (phone) to desktop; the board is the visual centre of the game screen.

Home — game title, nickname field, buttons "Create room", "Join with code", (V2) "Play vs bot". A 3-line "How to play".
Lobby — room code + copy-link button + QR code, the two player cards (nickname, colour, online dot, Ready state).
Mine placement — the empty board, click a cell to place / remove a mine (max 2), countdown bar, Confirm button, "Opponent is placing mines…" status.
Game — board in the centre; above it the two players with turn indicator and turn timer; own mines shown as a small discreet icon; chat panel on the right (bottom sheet on mobile) with preset buttons, emoji bar and text input.
End — overlay on the board: result, winning line glowing, every mine revealed, buttons Rematch / Back home.

Animations (what makes the demo feel good):

Hovering a column shows a ghost token above it.
Token drop with a gravity ease and a small bounce (~400 ms).
Explosion: flash + particles at the cell, short shake of the board, the column greys out with a "blocked 1 turn" badge.
Winning line: the 4 tokens pulse.
Chat: emoji reactions float up over the board for 2 s.

Accessibility: columns are keyboard-selectable (arrow keys + Enter), colours also differ by pattern/icon for colour-blind players, and turn changes are announced with aria-live.

8. Non-functional requirements, testing, deployment

The project is judged on code quality as much as on the game, so tests, structure and a clean README are part of the scope.

Non-functional

Move round-trip (click → result shown on both screens) under 200 ms on a normal connection.
No desync: the client always renders from server state.
Works on recent Chrome, Firefox, Safari and mobile browsers.
Inactive rooms are cleaned from memory after 30 min.
Code: ESLint + Prettier, strict TypeScript, no any in the shared package.

Testing

Unit tests on the game engine (Vitest): gravity, win detection in 4 directions, draws, mine explosion, own-mine safety, blocked columns, timeout moves. Target ≥ 90 % coverage on the engine.
Security test: per-player view never contains opponent mines.
Gateway integration tests: two Socket.IO clients play a full game.
One Playwright E2E test: two browser contexts create, join and finish a game, including a page refresh mid-game.

Deployment

docker-compose.yml with api, web, postgres (and redis in V2).
VPS behind Nginx with HTTPS (Let's Encrypt) and WebSocket upgrade headers configured.
GitHub Actions: lint + tests on every push, deploy on push to main.
Environment variables documented in .env.example.

README must include: live demo link, GIF of a game with an explosion, architecture diagram, how server authority hides the mines, how to run locally in one command, test command.

9. Milestones

The MVP takes about 4 weeks part-time; each milestone ends with something that runs and is committed.

Week 1 — Engine + setup: monorepo, shared types, pure game engine (board, gravity, wins, mines, blocked columns) with full unit tests. No UI yet.
Week 2 — Real-time backend: NestJS gateway, guest auth, rooms, lobby, mine placement, moves, timers, per-player views, reconnection. Tested with two socket clients.
Week 3 — Front end: Vue screens, board rendering from server state, drop and explosion animations, chat panel, end screen, rematch.
Week 4 — Polish + ship: mobile layout, accessibility, persistence of finished games, Docker, CI, VPS deploy, README with GIF and diagram.
After MVP (V2): play vs bot first (biggest demo value), then accounts, stats, replay, spectators, Redis.
10. Instructions for Claude (build assistant)

Use this section as the prompt context when asking Claude to build the project.

Build milestone by milestone (section 9). Do not start the next milestone before the current one runs and its tests pass.
Write the game engine first as pure, framework-free TypeScript in packages/shared or apps/api/src/game/engine, with tests, before any socket code.
Never send the opponent's unexploded mines to a client — always emit through a toPlayerView(state, playerId) function.
Keep event names and payload types in the shared package and import them on both sides; no string literals for events in components.
Prefer small, readable files; explain each new module in 2–3 lines before writing it.
Ask before adding a library that is not listed in section 2.
When a rule is ambiguous, follow section 3 and list the open question instead of inventing a rule.
At the end of each milestone, give: what was built, how to run it, how to test it, and what is next.
