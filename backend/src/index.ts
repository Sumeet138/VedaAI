import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { buildApp } from './app';
import { connectMongo } from './config/mongo';
import { env } from './config/env';
import { initSocket } from './socket/socket';
import { startWorker } from './queue/workers';
import { pdfService } from './papers/pdf.service';
import { redisConnection } from './config/redis';

const FORCE_EXIT_TIMEOUT_MS = 8_000;

async function main() {
  await connectMongo();

  const app = buildApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
  });

  initSocket(io);
  const { generationWorker, pdfWorker } = startWorker(io);

  // Track open sockets so we can force-close them on shutdown
  const sockets = new Set<import('net').Socket>();
  httpServer.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  // Fail fast with a clear message instead of an unhandled 'error' crash
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n\x1b[31m✖ Port ${env.PORT} is already in use.\x1b[0m\n` +
          `Another backend instance is still holding it.\n` +
          `Fix:  npx kill-port ${env.PORT}   (or run \`npm run dev\` again — predev kills it for you)\n`,
      );
      process.exit(1);
    }
    console.error('[http] unexpected server error:', err);
    process.exit(1);
  });

  httpServer.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[${signal}] graceful shutdown starting...`);

    // Hard-stop after FORCE_EXIT_TIMEOUT_MS so we never leak the port
    const forceExit = setTimeout(() => {
      console.error(`[shutdown] timeout — forcing exit`);
      process.exit(1);
    }, FORCE_EXIT_TIMEOUT_MS);
    forceExit.unref();

    try {
      // 1. Stop accepting new HTTP connections
      httpServer.close();

      // 2. Close socket.io (sends disconnect to all clients)
      await new Promise<void>((resolve) => io.close(() => resolve()));

      // 3. Destroy any lingering raw TCP sockets so close() can actually finish
      for (const s of sockets) s.destroy();
      sockets.clear();

      // 4. Close BullMQ workers (waits for active jobs to finish briefly)
      await Promise.all([generationWorker.close(), pdfWorker.close()]);

      // 5. Close puppeteer browser
      await pdfService.shutdown();

      // 6. Close Redis connection
      redisConnection.disconnect();

      console.log('[shutdown] clean exit');
      process.exit(0);
    } catch (err) {
      console.error('[shutdown] error during shutdown:', err);
      process.exit(1);
    }
  };

  // Standard signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  // tsx watch sends SIGTERM to old child; on Windows also send SIGHUP
  process.on('SIGHUP', () => shutdown('SIGHUP'));

  // Never leak the port on a crash
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    shutdown('unhandledRejection');
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
