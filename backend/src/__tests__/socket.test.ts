import { createServer, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { initSocket } from '../socket/socket';
import { SOCKET_EVENTS } from '@vedaai/shared';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function assertNotReceived(socket: ClientSocket, event: string, windowMs = 200): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`Should not have received "${event}"`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, windowMs);
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Socket.io', () => {
  let httpServer: HttpServer;
  let ioServer: Server;
  let serverUrl: string;

  // Track every client created per test so afterEach can clean them all up
  const activeClients = new Set<ClientSocket>();

  function createClient(): ClientSocket {
    const c = Client(serverUrl, { autoConnect: false });
    activeClients.add(c);
    return c;
  }

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer, { cors: { origin: '*' } });
    initSocket(ioServer);
    httpServer.listen(0, () => {
      const addr = httpServer.address() as { port: number };
      serverUrl = `http://localhost:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    ioServer.close(() => {
      if (httpServer.listening) httpServer.close(done);
      else done();
    });
  });

  afterEach(async () => {
    const disconnects = Array.from(activeClients)
      .filter((c) => c.connected)
      .map(
        (c) =>
          new Promise<void>((res) => {
            c.once('disconnect', () => res());
            c.disconnect();
          }),
      );
    await Promise.all(disconnects);
    activeClients.clear();
  });

  // ─── Connection ─────────────────────────────────────────────────────────

  it('client can connect', async () => {
    const client = createClient();
    client.connect();
    await waitFor(client, 'connect');
    expect(client.connected).toBe(true);
  });

  // ─── Room join ──────────────────────────────────────────────────────────

  it('client receives events after joining a room', async () => {
    const client = createClient();
    client.connect();
    await waitFor(client, 'connect');

    client.emit(SOCKET_EVENTS.JOIN_ROOM, 'assignment-001');
    await delay(80);

    ioServer.to('assignment-001').emit(SOCKET_EVENTS.JOB_PROGRESS, {
      assignmentId: 'assignment-001',
      status: 'generating',
      progress: 50,
    });

    const data = await waitFor<{ progress: number }>(client, SOCKET_EVENTS.JOB_PROGRESS);
    expect(data.progress).toBe(50);
  });

  it('client receives job:completed event in its room', async () => {
    const client = createClient();
    client.connect();
    await waitFor(client, 'connect');

    client.emit(SOCKET_EVENTS.JOIN_ROOM, 'assignment-002');
    await delay(80);

    ioServer.to('assignment-002').emit(SOCKET_EVENTS.JOB_COMPLETED, {
      assignmentId: 'assignment-002',
      paperId: 'paper-xyz',
      progress: 100,
    });

    const data = await waitFor<{ paperId: string }>(client, SOCKET_EVENTS.JOB_COMPLETED);
    expect(data.paperId).toBe('paper-xyz');
  });

  // ─── Room isolation ─────────────────────────────────────────────────────

  it('client does NOT receive events meant for a different room', async () => {
    const client = createClient();
    client.connect();
    await waitFor(client, 'connect');

    client.emit(SOCKET_EVENTS.JOIN_ROOM, 'room-A');
    await delay(80);

    ioServer.to('room-B').emit(SOCKET_EVENTS.JOB_PROGRESS, { progress: 99 });

    await assertNotReceived(client, SOCKET_EVENTS.JOB_PROGRESS);
  });

  it('client NOT in any room does not receive room events', async () => {
    const client = createClient();
    client.connect();
    await waitFor(client, 'connect');

    ioServer.to('some-room').emit(SOCKET_EVENTS.JOB_PROGRESS, { progress: 10 });

    await assertNotReceived(client, SOCKET_EVENTS.JOB_PROGRESS);
  });

  // ─── Leave room ─────────────────────────────────────────────────────────

  it('client stops receiving events after leaving room', async () => {
    const client = createClient();
    client.connect();
    await waitFor(client, 'connect');

    client.emit(SOCKET_EVENTS.JOIN_ROOM, 'room-leavetest');
    await delay(80);

    client.emit(SOCKET_EVENTS.LEAVE_ROOM, 'room-leavetest');
    await delay(120); // larger gap — server must process leave before we emit

    ioServer.to('room-leavetest').emit(SOCKET_EVENTS.JOB_PROGRESS, { progress: 100 });

    await assertNotReceived(client, SOCKET_EVENTS.JOB_PROGRESS);
  });

  // ─── Multiple clients ───────────────────────────────────────────────────

  it('multiple clients in same room all receive the event', async () => {
    const client1 = createClient();
    const client2 = createClient();

    client1.connect();
    client2.connect();
    await Promise.all([waitFor(client1, 'connect'), waitFor(client2, 'connect')]);

    client1.emit(SOCKET_EVENTS.JOIN_ROOM, 'shared-room');
    client2.emit(SOCKET_EVENTS.JOIN_ROOM, 'shared-room');
    await delay(120); // both joins must be processed before emit

    ioServer.to('shared-room').emit(SOCKET_EVENTS.JOB_PROGRESS, { progress: 75 });

    const [d1, d2] = await Promise.all([
      waitFor<{ progress: number }>(client1, SOCKET_EVENTS.JOB_PROGRESS),
      waitFor<{ progress: number }>(client2, SOCKET_EVENTS.JOB_PROGRESS),
    ]);

    expect(d1.progress).toBe(75);
    expect(d2.progress).toBe(75);
  });
});
