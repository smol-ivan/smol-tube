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
}

export function applyPlaylistAdd(
    room: Room,
    request: ApplyPlaylistAddRequest,
): Room | null {
    const { requestingUser, addedVideo } = request;

    if (!hasPermission(requestingUser, "playlist:add")) {
        return null;
    }

    const updatedRoom: Room = {
        ...room,
        playlist: [...room.playlist],
    };

    updatedRoom.playlist.push(addedVideo);

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
    )

    if (idxRemovedVideo < 0) {
        return null;
    }

    updatedRoom.playlist.splice(idxRemovedVideo, 1)


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
