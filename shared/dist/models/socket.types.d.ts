export type JobProgressStatus = 'queued' | 'extracting' | 'prompting' | 'generating' | 'parsing' | 'saving' | 'completed' | 'failed';
export interface JobProgressEvent {
    assignmentId: string;
    jobId: string;
    status: JobProgressStatus;
    progress: number;
    message: string;
    paperId?: string;
    error?: string;
}
export interface PdfReadyEvent {
    assignmentId: string;
    version: number;
    /** Server-relative download URL — frontend prefixes with API base */
    downloadPath: string;
    cached: boolean;
}
export interface PdfFailedEvent {
    assignmentId: string;
    error: string;
}
export declare const SOCKET_EVENTS: {
    readonly JOIN_ROOM: "join:room";
    readonly LEAVE_ROOM: "leave:room";
    readonly JOB_PROGRESS: "job:progress";
    readonly JOB_COMPLETED: "job:completed";
    readonly JOB_FAILED: "job:failed";
    readonly PDF_READY: "pdf:ready";
    readonly PDF_FAILED: "pdf:failed";
};
//# sourceMappingURL=socket.types.d.ts.map