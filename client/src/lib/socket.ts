'use client';

import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;
let currentToken: string | null = null;

/** Socket server = API origin without the /api/v1 path. */
const SOCKET_URL = API_URL.replace(/\/api\/v\d+\/?$/, '');

export const getSocket = (token: string) => {
  if (socket && currentToken === token) return socket;
  socket?.disconnect();
  currentToken = token;
  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 10_000 });
  return socket;
};

export const peekSocket = () => socket;

export const closeSocket = () => {
  socket?.disconnect();
  socket = null;
  currentToken = null;
};
