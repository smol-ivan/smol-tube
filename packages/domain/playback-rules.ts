// domain/playback-rules.ts
//
// Mismo ejemplo que vimos antes (applyMediaUpdate), ahora escrito con
// las entidades reales que acabamos de definir. Esta es la función
// que tanto tu adapter de Socket.IO local como tu Lambda de producción
// van a llamar -- sin reescribirla.

import { Room, isBanned } from "./room";
import { User, hasPermission } from "./user";
import { Connection } from "./connection";

export interface MediaUpdateRequest {
    requestingUser: User;
    videoId: string;
    currentTime: number;
    paused: boolean;
}

// Devuelve el nuevo estado de reproducción si la petición es válida,
// o null si debe ignorarse (mismo comportamiento que el
// "if (this.leader !== user) return;" que vimos en playlist.js).
export function applyMediaUpdate(
    room: Room,
    request: MediaUpdateRequest,
): Room | null {
    const { requestingUser, videoId, currentTime, paused } = request;

    if (room.playback.leaderUserId !== requestingUser.userId) {
        return null; // no es el leader, se ignora
    }

    if (room.playback.videoId !== videoId) {
        return null; // el update es de un video que ya no es el actual
    }

    if (!hasPermission(requestingUser, "playback:control")) {
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

export function applyBecomeLeader(
    room: Room,
    request: BecomeLeaderRequest,
): Room | null {
    const { requestingUser } = request;

    if (isBanned(room, requestingUser.userId)) {
        return null;
    }

    if (!hasPermission(requestingUser, "playback:becomeLeader")) {
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

export interface ApplyPlaylistPlayRequest {
    requestingUser: User;
    itemId: string;
}

export function applyPlaylistPlay(
    room: Room,
    request: ApplyPlaylistPlayRequest,
): Room | null {
    const { requestingUser, itemId } = request;

    // Solo el leader actual o alguien con permisos de control de playback (admin)
    if (room.playback.leaderUserId !== requestingUser.userId) {
        if (!hasPermission(requestingUser, "playback:control")) {
            return null;
        }
    }

    const itemIndex = room.playlist.findIndex(item => item.itemId === itemId);
    if (itemIndex < 0) return null;

    const itemToPlay = room.playlist[itemIndex];
    if (!itemToPlay) return null;

    // Mueve el video seleccionado al inicio (índice 0) que representa el video actual
    const updatedPlaylist = [...room.playlist];
    updatedPlaylist.splice(itemIndex, 1);

    // El video actual viejo va al historial si existía y no es el mismo que estamos reproduciendo
    const updatedHistory = [...room.history];
    const currentFirst = room.playlist[0];
    if (currentFirst && currentFirst.itemId !== itemId) {
        updatedHistory.unshift(currentFirst);
        if (updatedHistory.length > 3) {
            updatedHistory.pop();
        }
        // Si estamos seleccionando un item que no era el primero, sacamos el viejo primer item
        if (itemIndex !== 0 && updatedPlaylist.length > 0) {
            updatedPlaylist.shift();
        }
    }

    updatedPlaylist.unshift(itemToPlay);

    return {
        ...room,
        playlist: updatedPlaylist,
        history: updatedHistory,
        skipVotes: [],
        playback: {
            ...room.playback,
            videoId: itemToPlay.videoId,
            currentTime: 0,
            paused: false,
        },
    };
}

export interface ApplyTransitionToNextRequest {
    // Si el autoskip lo lanza el líder, requestingUser será el líder. Si es por votos, podría no ser necesario,
    // pero mantenemos la firma.
    requestingUser: User;
}

export function applyTransitionToNext(
    room: Room,
    request: ApplyTransitionToNextRequest,
): Room | null {
    const { requestingUser } = request;

    // Solo puede avanzar si es el leader o alguien con permisos, O si ya se cumplieron los votos.
    // Asumiremos que el backend valora si se puede llamar basado en la cantidad de votos, 
    // o si el líder dice "ya terminó".
    if (room.playback.leaderUserId !== requestingUser.userId) {
        if (!hasPermission(requestingUser, "playback:control") && room.skipVotes.length === 0) {
            return null;
        }
    }

    const updatedPlaylist = [...room.playlist];
    const updatedHistory = [...room.history];

    if (updatedPlaylist.length > 0) {
        const finishedVideo = updatedPlaylist.shift();
        if (finishedVideo) {
            updatedHistory.unshift(finishedVideo);
            if (updatedHistory.length > 3) {
                updatedHistory.pop();
            }
        }
    }

    const nextItem = updatedPlaylist.length > 0 ? updatedPlaylist[0] : undefined;
    const nextVideoId = nextItem?.videoId ?? null;

    return {
        ...room,
        playlist: updatedPlaylist,
        history: updatedHistory,
        skipVotes: [],
        playback: {
            ...room.playback,
            videoId: nextVideoId,
            currentTime: 0,
            paused: false,
        }
    };
}

export interface ApplySkipVoteRequest {
    requestingUser: User;
}

export function applySkipVote(
    room: Room,
    request: ApplySkipVoteRequest,
): Room | null {
    if (room.skipVotes.includes(request.requestingUser.userId)) {
        return null; // Ya votó
    }
    return {
        ...room,
        skipVotes: [...room.skipVotes, request.requestingUser.userId]
    };
}
