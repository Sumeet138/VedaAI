'use client';

import { useEffect, useRef } from 'react';
import { SOCKET_EVENTS } from '@vedaai/shared';
import { getSocket } from '@/lib/socket';
import { useAssignmentStore } from '@/store/assignment.store';
import { usePaperStore, type ProgressEvent } from '@/store/paper.store';
import { getPaper } from '@/lib/api';

export function useSocket(assignmentId: string | null) {
  const joinedRef = useRef<string | null>(null);
  const upsert = useAssignmentStore((s) => s.upsert);
  const { setProgress, setPaper } = usePaperStore();

  useEffect(() => {
    if (!assignmentId) return;

    const socket = getSocket();

    if (!socket.connected) socket.connect();

    const onConnect = () => {
      if (joinedRef.current !== assignmentId) {
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, assignmentId);
        joinedRef.current = assignmentId;
      }
    };

    const onProgress = (data: ProgressEvent) => {
      setProgress(assignmentId, data);
      if (data.status === 'processing' || data.status === 'generating') {
        upsert({ _id: assignmentId } as never);
      }
    };

    const onCompleted = async (data: ProgressEvent & { paperId: string }) => {
      setProgress(assignmentId, { ...data, progress: 100 });
      try {
        const { paper, assignment } = await getPaper(assignmentId);
        setPaper(assignmentId, paper);
        upsert(assignment);
      } catch {
        // paper will be fetched on page load
      }
    };

    const onFailed = (data: ProgressEvent) => {
      setProgress(assignmentId, data);
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.on('connect', onConnect);
    }

    socket.on(SOCKET_EVENTS.JOB_PROGRESS, onProgress);
    socket.on(SOCKET_EVENTS.JOB_COMPLETED, onCompleted);
    socket.on(SOCKET_EVENTS.JOB_FAILED, onFailed);

    return () => {
      socket.off('connect', onConnect);
      socket.off(SOCKET_EVENTS.JOB_PROGRESS, onProgress);
      socket.off(SOCKET_EVENTS.JOB_COMPLETED, onCompleted);
      socket.off(SOCKET_EVENTS.JOB_FAILED, onFailed);

      if (joinedRef.current === assignmentId) {
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM, assignmentId);
        joinedRef.current = null;
      }
    };
  }, [assignmentId, upsert, setProgress, setPaper]);
}
