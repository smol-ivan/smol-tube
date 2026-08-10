import { ChatMessage, isValidChatMessage } from "./chat-message";
import { Connection } from "./connection";
import { BanEntry, PlaylistItem, Room } from "./room";
import { hasPermission, User } from "./user";

export interface ApplyKickRequest {
    requestingUser: User;
    kickedUser: User;
    kickedUserConnection: Connection;
}

export interface KickResult {
    updatedRoom: Room;
    connectionToDisconnect: Connection;
}

export function applyKick(
    room: Room,
    request: ApplyKickRequest,
): KickResult | null {
    const { requestingUser, kickedUser, kickedUserConnection } = request;

    if (!hasPermission(requestingUser, "moderation:kick")) {
        return null;
    }

    // Cannot self kick
    if (requestingUser.userId === kickedUser.userId) {
        return null;
    }

    const updatedRoom: Room = {
        ...room,
        playback: { ...room.playback },
    };

    //  Free leader if kicked user was it
    if (updatedRoom.playback.leaderUserId === kickedUser.userId) {
        updatedRoom.playback.leaderUserId = null;
    }

    return {
        updatedRoom,
        connectionToDisconnect: kickedUserConnection,
    };
}

export interface ApplyBanRequest {
    requestingUser: User;
    bannedUser: BanEntry;
}

export function applyBan(room: Room, request: ApplyBanRequest): Room | null {
    const { requestingUser, bannedUser } = request;

    if (!hasPermission(requestingUser, "moderation:ban")) {
        return null;
    }

    // Cannot self ban
    if (requestingUser.userId === bannedUser.bannedUserId) {
        return null;
    }

    const updatedRoom: Room = {
        ...room,
        bans: [...room.bans],
        playback: { ...room.playback },
    };

    if (updatedRoom.playback.leaderUserId === bannedUser.bannedUserId) {
        updatedRoom.playback.leaderUserId = null;
    }

    updatedRoom.bans.push(bannedUser);

    return updatedRoom;
}

export interface ApplyUnbanRequest {
    requestingUser: User;
    unbannedUser: BanEntry;
}

export function applyUnban(
    room: Room,
    request: ApplyUnbanRequest,
): Room | null {
    const { requestingUser, unbannedUser } = request;

    if (!hasPermission(requestingUser, "moderation:unban")) {
        return null;
    }

    const updatedRoom: Room = {
        ...room,
        bans: [...room.bans],
    };

    const idxUnbannedUser = updatedRoom.bans.findIndex(
        (b) => b.bannedUserId === unbannedUser.bannedUserId,
    );

    if (idxUnbannedUser < 0) {
        return null;
    }

    updatedRoom.bans.splice(idxUnbannedUser, 1);

    return updatedRoom;
}

export interface ApplyGrantModeratorRequest {
    requestingUser: User;
    grantedModeratorUser: User;
}

// export interface GrantModeratorResult {
//     updated: User;
// }

export function applyGrantModerator(
    request: ApplyGrantModeratorRequest,
): User | null {
    const { requestingUser, grantedModeratorUser } = request;

    if (!hasPermission(requestingUser, "roles:grantModerator")) {
        return null;
    }

    const updatedUser: User = {
        ...grantedModeratorUser,
        role: "moderator",
    };

    return updatedUser;
}

export interface ApplyRevokeModeratorRequest {
    requestingUser: User;
    revokedModeratorUser: User;
}

// export interface RevokeModeratorResult {
//     updated: User;
// }

export function applyRevokeModerator(
    request: ApplyRevokeModeratorRequest,
): User | null {
    const { requestingUser, revokedModeratorUser } = request;

    if (!hasPermission(requestingUser, "roles:revokeModerator")) {
        return null;
    }

    const updatedUser: User = {
        ...revokedModeratorUser,
        role: "guest",
    };

    return updatedUser;

    // TODO: Revisar roles, guest deberia de ser alguien sin cuenta
    // y con funciones limitadas, falta un rol para gente con cuenta pero que no es moderador
}

export interface ApplyChatMessageRequest {
    requestingUser: User;
    message: ChatMessage;
}

// export interface ChatMessageResult {
//     message: ChatMessage;
// }

export function applyChatMessage(
    request: ApplyChatMessageRequest,
): ChatMessage | null {
    const { requestingUser, message: message } = request;

    if (!hasPermission(requestingUser, "chat:send")) {
        return null;
    }

    if (!isValidChatMessage(message.text)) {
        return null;
    }

    return message;
}

export interface ApplyPlaylistAddRequest {
    requestingUser: User;
    addedVideo: PlaylistItem;
    atTop?: boolean;
}

export function applyPlaylistAdd(
    room: Room,
    request: ApplyPlaylistAddRequest,
): Room | null {
    const { requestingUser, addedVideo, atTop } = request;

    if (!hasPermission(requestingUser, "playlist:add")) {
        return null;
    }

    const updatedRoom: Room = {
        ...room,
        playlist: [...room.playlist],
        playback: { ...room.playback },
    };

    if (atTop && updatedRoom.playlist.length > 0) {
        // Insert right after the currently playing video (index 1)
        updatedRoom.playlist.splice(1, 0, addedVideo);
    } else {
        // Queue last
        updatedRoom.playlist.push(addedVideo);
    }

    if (!updatedRoom.playback.videoId) {
        updatedRoom.playback.videoId = addedVideo.videoId;
        updatedRoom.playback.currentTime = 0;
        updatedRoom.playback.paused = false;
    }

    return updatedRoom;
}

export interface ApplyPlaylistRemoveRequest {
    requestingUser: User;
    removedVideo: PlaylistItem;
}

export function applyPlaylistRemove(
    room: Room,
    request: ApplyPlaylistRemoveRequest,
): Room | null {
    const { requestingUser, removedVideo } = request;

    if (!hasPermission(requestingUser, "playlist:remove")) {
        return null;
    }

    const updatedRoom: Room = {
        ...room,
        playlist: [...room.playlist],
    };

    const idxRemovedVideo = updatedRoom.playlist.findIndex(
        (item) => item.itemId === removedVideo.itemId,
    );

    if (idxRemovedVideo < 0) {
        return null;
    }

    updatedRoom.playlist.splice(idxRemovedVideo, 1);

    return updatedRoom;
}

export interface ApplyPlaylistReorderRequest {
    requestingUser: User;
    fromIndex: number;
    toIndex: number;
}

export function applyPlaylistReorder(
    room: Room,
    request: ApplyPlaylistReorderRequest,
): Room | null {
    const { requestingUser, fromIndex, toIndex } = request;

    if (!hasPermission(requestingUser, "playlist:reorder")) {
        return null;
    }

    if (
        fromIndex < 0 ||
        fromIndex >= room.playlist.length ||
        toIndex < 0 ||
        toIndex >= room.playlist.length
    ) {
        return null;
    }

    const updatedPlaylist = [...room.playlist];
    const [movedItem] = updatedPlaylist.splice(fromIndex, 1);
    if (!movedItem) {
        return null;
    }
    updatedPlaylist.splice(toIndex, 0, movedItem);

    return {
        ...room,
        playlist: updatedPlaylist,
    };
}

// export interface applyTransitionToNextRequest {
//     currentVideo: PlaylistItem | null;
//     nextVideo: PlaylistItem | null;
//     remainingPlaylist: PlaylistItem[];
// }
//
//
// export function applyTransitionToNext(
//     room: Room,
//     request: applyTransitionToNextRequest,
// ): Room | null {
//     const { currentVideo,nextVideo, remainingPlaylist } = request;
//
//     const updatedHistory = [...room.history];
//
//     if (currentVideo) {
//         updatedHistory.push(currentVideo)
//     }
//
//     if (updatedHistory.length > 3) {
//         updatedHistory.shift()
//     }
//
//     return {
//         ...room,
//         history: updatedHistory,
//         skipVotes: [],
//         // TODO: Revisar como regresar el nuevo video actual,
//         // y si es necesario tener un atributo currentVideo: PlaylistItem, 
//         // ya que tenemos 
//     }
// }
