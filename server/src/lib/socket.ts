import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { JwtPayload } from '../middlewares/auth';

let io: Server | null = null;

export const userRoom = (userId: string) => `user:${userId}`;
export const conversationRoom = (id: string) => `conv:${id}`;

/** Lazily-registered guard so the chat module decides who may join a conversation room. */
type JoinGuard = (userId: string, conversationId: string) => Promise<boolean>;
let joinGuard: JoinGuard = async () => false;
export const setConversationJoinGuard = (fn: JoinGuard) => {
  joinGuard = fn;
};

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: { origin: env.clientUrls, credentials: true },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
      socket.data.userId = payload.sub;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(userRoom(userId));

    socket.on('conversation:join', async (conversationId: string, ack?: (ok: boolean) => void) => {
      const ok = typeof conversationId === 'string' && (await joinGuard(userId, conversationId).catch(() => false));
      if (ok) socket.join(conversationRoom(conversationId));
      ack?.(ok);
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(conversationRoom(conversationId));
    });

    socket.on('typing', (payload: { conversationId: string; name: string }) => {
      if (!payload?.conversationId || !socket.rooms.has(conversationRoom(payload.conversationId))) return;
      socket.to(conversationRoom(payload.conversationId)).emit('typing', { ...payload, userId });
    });
  });

  return io;
};

export const getIO = () => io;

/** Emit to many users' personal rooms (no-op when sockets are not initialised, e.g. in scripts). */
export const emitToUsers = (userIds: string[], event: string, payload: unknown) => {
  if (!io || !userIds.length) return;
  io.to(userIds.map(userRoom)).emit(event, payload);
};

export const isUserOnline = async (userId: string) => {
  if (!io) return false;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
};
