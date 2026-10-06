import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { initSocket, setConversationJoinGuard } from './lib/socket';
import { canJoinConversation } from './modules/chat/chat.service';
import { ReminderService } from './modules/reminder/reminder.service';

const start = async () => {
  try {
    await connectDB();
    const server = http.createServer(app);
    initSocket(server);
    setConversationJoinGuard(canJoinConversation);
    ReminderService.start();
    server.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`ClassHub API listening on http://localhost:${env.port}`);
    });

    const shutdown = (signal: string) => {
      // eslint-disable-next-line no-console
      console.log(`${signal} received, closing server...`);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', reason);
});

start();
