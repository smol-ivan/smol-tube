// domain/playback-rules.ts
//
// Mismo ejemplo que vimos antes (applyMediaUpdate), ahora escrito con
// las entidades reales que acabamos de definir. Esta es la función
// que tanto tu adapter de Socket.IO local como tu Lambda de producción
// van a llamar -- sin reescribirla.

import { Room, isBanned } from './room';
import { User, hasPermission } from './user';

export interface MediaUpdateRequest {
    requestingUser: User;
    videoId: string;
    currentTime: number;
    paused: boolean;
}

// Devuelve el nuevo estado de reproducción si la petición es válida,
// o null si debe ignorarse (mismo comportamiento que el
// "if (this.leader !== user) return;" que vimos en playlist.js).
export function applyMediaUpdate(room: Room, request: MediaUpdateRequest): Room | null {
    const { requestingUser, videoId, currentTime, paused } = request;

    if (room.playback.leaderUserId !== requestingUser.userId) {
        return null; // no es el leader, se ignora
    }

    if (room.playback.videoId !== videoId) {
        return null; // el update es de un video que ya no es el actual
    }

    if (!hasPermission(requestingUser, 'playback:control')) {
        return null; // por si el rol cambió a media conexión
    }

    return {
        ...room,
        playback: {
            ...room.playback,
            currentTime,
            paused,
        },
    };
}

export interface BecomeLeaderRequest {
    requestingUser: User;
}

export function applyBecomeLeader(room: Room, request: BecomeLeaderRequest): Room | null {
    const { requestingUser } = request;

    if (isBanned(room, requestingUser.userId)) {
        return null;
    }

    if (!hasPermission(requestingUser, 'playback:becomeLeader')) {
        return null;
    }

    return {
        ...room,
        playback: {
            ...room.playback,
            leaderUserId: requestingUser.userId,
        },
    };
}
