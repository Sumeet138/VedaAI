import type { Server } from 'socket.io';
import { SOCKET_EVENTS } from '@vedaai/shared';

export function initSocket(io: Server): void {
  io.on('connection', (socket) => {
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (assignmentId: string) => {
      socket.join(assignmentId);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (assignmentId: string) => {
      socket.leave(assignmentId);
    });
  });
}
