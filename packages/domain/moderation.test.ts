import { describe, expect, it } from "vitest";
import {
    applyKick,
    applyBan,
    applyUnban,
    applyGrantModerator,
    applyRevokeModerator,
    applyChatMessage,
    applyPlaylistRemove,
} from "./moderation";
import { createEmptyRoom } from "./room";
import { User } from "./user";
import { Connection } from "./connection";

describe("moderation - applyKick", () => {
    const room = createEmptyRoom("main", null);

    const modUser: User = {
        userId: "mod-1",
        displayName: "Moderator",
        role: "moderator",
        passwordHash: "hash",
        expiresAt: null,
    };
    const guestUser: User = {
        userId: "guest-1",
        displayName: "Guest",
        role: "guest",
        passwordHash: null,
        expiresAt: null,
    };
    const guestConnection: Connection = {
        connectionId: "conn-123",
        roomId: "main",
        userId: "guest-1",
        connectedAt: Date.now(),
    };

    it("debe permitir a un moderador kickear a un invitado", () => {
        const result = applyKick(room, {
            requestingUser: modUser,
            kickedUser: guestUser,
            kickedUserConnection: guestConnection,
        });
        expect(result).not.toBeNull();
        expect(result?.connectionToDisconnect.connectionId).toBe("conn-123");
    });

    it("debe rechazar el kick si un invitado intenta kickear", () => {
        const result = applyKick(room, {
            requestingUser: guestUser,
            kickedUser: modUser,
            kickedUserConnection: guestConnection,
        });
        expect(result).toBeNull();
    });
});

describe("moderation - applyBan", () => {
    const modUser: User = {
        userId: "mod-1",
        displayName: "Moderator",
        role: "moderator",
        passwordHash: "hash",
        expiresAt: null,
    };

    it("debe banear correctamente sin corromper playback", () => {
        const room = createEmptyRoom("main", null);
        room.playback.leaderUserId = "guest-1";

        const result = applyBan(room, {
            requestingUser: modUser,
            bannedUser: {
                bannedUserId: "guest-1",
                bannedDisplayName: "Guest",
                bannedByUserId: "mod-1",
                bannedAt: Date.now(),
            },
        });

        expect(result).not.toBeNull();
        expect(result?.bans.length).toBe(1);
        expect(result?.playback.leaderUserId).toBeNull(); // se libera el leader baneado
        // el room original NO debe mutarse
        expect(room.bans.length).toBe(0);
    });
});

describe("moderation - applyUnban", () => {
    const adminUser: User = {
        userId: "admin-1",
        displayName: "Admin",
        role: "admin",
        passwordHash: "hash",
        expiresAt: null,
    };

    it("debe desbanear a un usuario existente", () => {
        let room = createEmptyRoom("main", null);
        room.bans.push({
            bannedUserId: "guest-1",
            bannedDisplayName: "Guest",
            bannedByUserId: "mod-1",
            bannedAt: Date.now(),
        });

        const result = applyUnban(room, {
            requestingUser: adminUser,
            unbannedUser: {
                bannedUserId: "guest-1",
                bannedDisplayName: "Guest",
                bannedByUserId: "mod-1",
                bannedAt: Date.now(),
            },
        });

        expect(result).not.toBeNull();
        expect(result?.bans.length).toBe(0);
    });

    it("debe devolver null si el usuario no estaba baneado", () => {
        const room = createEmptyRoom("main", null);
        const result = applyUnban(room, {
            requestingUser: adminUser,
            unbannedUser: {
                bannedUserId: "nope",
                bannedDisplayName: "Nope",
                bannedByUserId: "mod-1",
                bannedAt: Date.now(),
            },
        });
        expect(result).toBeNull();
    });
});

describe("moderation - applyGrantModerator", () => {
    const adminUser: User = {
        userId: "admin-1",
        displayName: "Admin",
        role: "admin",
        passwordHash: "hash",
        expiresAt: null,
    };

    it("debe devolver un User actualizado SIN mutar el original", () => {
        const guestUser: User = {
            userId: "guest-1",
            displayName: "Guest",
            role: "guest",
            passwordHash: null,
            expiresAt: null,
        };

        const resultUpdatedUser = applyGrantModerator({
            requestingUser: adminUser,
            grantedModeratorUser: guestUser,
        });

        expect(resultUpdatedUser).not.toBeNull();
        expect(resultUpdatedUser?.role).toBe("moderator");
        expect(guestUser.role).toBe("guest"); // el original NO debe cambiar
    });
});

describe("moderation - applyChatMessage", () => {
    const guestUser: User = {
        userId: "guest-1",
        displayName: "Guest",
        role: "guest",
        passwordHash: null,
        expiresAt: null,
    };

    it("debe validar y devolver el mensaje sin Room", () => {
        const resultMessage = applyChatMessage({
            requestingUser: guestUser,
            message: {
                fromUserId: "guest-1",
                fromDisplayName: "Guest",
                text: "hola",
                sentAt: Date.now(),
            },
        });

        expect(resultMessage).not.toBeNull();
        expect(resultMessage?.text).toBe("hola");
    });
});

describe("moderation - applyPlaylistRemove", () => {
    const modUser: User = {
        userId: "mod-1",
        displayName: "Moderator",
        role: "moderator",
        passwordHash: "hash",
        expiresAt: null,
    };

    it("debe remover solo el item indicado, dejando los demás intactos", () => {
        const room = createEmptyRoom("main", null);
        room.playlist.push(
            {
                itemId: "a",
                videoId: "v1",
                title: "Video 1",
                addedByUserId: "u1",
                durationSeconds: 100,
            },
            {
                itemId: "b",
                videoId: "v2",
                title: "Video 2",
                addedByUserId: "u1",
                durationSeconds: 200,
            },
            {
                itemId: "c",
                videoId: "v3",
                title: "Video 3",
                addedByUserId: "u1",
                durationSeconds: 300,
            },
        );

        const result = applyPlaylistRemove(room, {
            requestingUser: modUser,
            removedVideo: {
                itemId: "b",
                videoId: "v2",
                title: "Video 2",
                addedByUserId: "u1",
                durationSeconds: 200,
            },
        });

        expect(result).not.toBeNull();
        expect(result?.playlist.length).toBe(2);
        expect(result?.playlist.map((i) => i.itemId)).toEqual(["a", "c"]);
    });

    it("debe devolver null si el item a remover no existe (no debe borrar el último por error)", () => {
        const room = createEmptyRoom("main", null);
        room.playlist.push({
            itemId: "a",
            videoId: "v1",
            title: "Video 1",
            addedByUserId: "u1",
            durationSeconds: 100,
        });

        const result = applyPlaylistRemove(room, {
            requestingUser: modUser,
            removedVideo: {
                itemId: "no-existe",
                videoId: "v9",
                title: "X",
                addedByUserId: "u1",
                durationSeconds: 1,
            },
        });

        expect(result).toBeNull();
    });
});
