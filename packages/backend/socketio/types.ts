import { Role } from "@smol-tube/domain";

export type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
export type AckFn<T = unknown> = (response: Ack<T>) => void;

export interface JoinRoomPayload {
    displayName: string;
    password?: string;
    roomId?: string;
}

export interface MediaUpdatePayload {
    videoId: string;
    currentTime: number;
    paused: boolean;
}

export interface SetActiveVideoPayload {
    videoId: string;
}

export interface ChatMsgPayload {
    text: string;
}

export interface TargetUserPayload {
    targetUserId: string;
}

export interface SeedUserConfig {
    displayName: string;
    password: string;
    role: Role;
}

export interface PlaylistAddPayload {
    videoId: string;
    title: string;
    durationSeconds: number;
}

export interface PlaylistRemovePayload {
    itemId: string;
}

export interface PlaylistReorderPayload {
    fromIndex: number;
    toIndex: number;
}
