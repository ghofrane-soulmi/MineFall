/**
 * Socket.IO event names (SPEC section 5), shared by api and web so no event is ever a
 * string literal in a gateway or component. Payload types live in protocol/socket.ts.
 */
export const SOCKET_NAMESPACE = '/game';

export const ClientEvents = {
  RoomCreate: 'room:create',
  RoomJoin: 'room:join',
  RoomWatch: 'room:watch',
  RoomReady: 'room:ready',
  RoomLeave: 'room:leave',
  MinesPlace: 'mines:place',
  MoveDrop: 'move:drop',
  ChatSend: 'chat:send',
  GameRematch: 'game:rematch',
  QueueJoin: 'queue:join',
  QueueLeave: 'queue:leave',
} as const;

export const ServerEvents = {
  RoomState: 'room:state',
  RoomPlayers: 'room:players',
  PhaseChanged: 'phase:changed',
  DiceRolled: 'dice:rolled',
  QueueMatched: 'queue:matched',
  MinesConfirmed: 'mines:confirmed',
  MoveResult: 'move:result',
  GameOver: 'game:over',
  ChatMessage: 'chat:message',
  PlayerDisconnected: 'player:disconnected',
  PlayerReconnected: 'player:reconnected',
  Error: 'error',
} as const;

export type ClientEventName = (typeof ClientEvents)[keyof typeof ClientEvents];
export type ServerEventName = (typeof ServerEvents)[keyof typeof ServerEvents];
