import express, { Request, Response } from "express";
import http from "node:http";
import {
    applyBan,
    applyBecomeLeader,
    applyChatMessage,
    applyGrantModerator,
    applyKick,
    applyMediaUpdate,
    applyRevokeModerator,
    applyUnban,
    BanEntry,
    Connection,
    createEmptyRoom,
    createGuestUser,
    isBanned,
    Role,
    Room,
    User,
} from "@smol-tube/domain";
import { Server } from "socket.io";
import { InMemoryConnectionRepository } from "../repositories/InMemoryConnectionRepository";
import { InMemoryRoomRepository } from "../repositories/InMemoryRoomRepository";
import { InMemoryUserRepository } from "../repositories/InMemoryUserRepository";

const DEFAULT_ROOM_ID = "main";
const DEFAULT_PORT = 3000;
const EPOCH_TTL_DISABLED = null;

const roomRepository = new InMemoryRoomRepository();
const userRepository = new InMemoryUserRepository();
const connectionRepository = new InMemoryConnectionRepository();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
type AckFn<T = unknown> = (response: Ack<T>) => void;

interface JoinRoomPayload {
    displayName: string;
    password?: string;
    roomId?: string;
}

interface MediaUpdatePayload {
    videoId: string;
    currentTime: number;
    paused: boolean;
}

interface SetActiveVideoPayload {
    videoId: string;
}

interface ChatMsgPayload {
    text: string;
}

interface TargetUserPayload {
    targetUserId: string;
}

interface SeedUserConfig {
    displayName: string;
    password: string;
    role: Role;
}

function normalizeDisplayName(displayName: string): string {
    return displayName.trim();
}

function userIdFromGuestName(displayName: string): string {
    return `guest:${displayName.toLowerCase().replace(/\s+/g, "-")}`;
}

function mockPasswordHash(password: string): string {
    return `mock:${password}`;
}

function compareMockPassword(password: string, hash: string | null): boolean {
    if (!hash) {
        return false;
    }
    return hash === mockPasswordHash(password);
}

function readEnvRequiredIfPair(
    nameKey: string,
    passwordKey: string,
): { displayName: string; password: string } | null {
    const displayName = process.env[nameKey]?.trim();
    const password = process.env[passwordKey]?.trim();
    if (!displayName || !password) {
        return null;
    }
    return { displayName, password };
}

async function ensureMainRoom(): Promise<Room> {
    const existing = await roomRepository.getRoom(DEFAULT_ROOM_ID);
    if (existing) {
        return existing;
    }

    const created = createEmptyRoom(DEFAULT_ROOM_ID, EPOCH_TTL_DISABLED);
    await roomRepository.saveRoom(created);
    return created;
}

async function seedMockAccounts(): Promise<void> {
    const seedUsersJson = process.env.SEED_USERS_JSON?.trim();
    if (seedUsersJson) {
        const parsed = parseSeedUsersJson(seedUsersJson);
        const validated = validateSeedUsers(parsed);

        await Promise.all(
            validated.map((seedUser) =>
                userRepository.saveUser({
                    userId: `${seedUser.role}:${seedUser.displayName.toLowerCase()}`,
                    displayName: seedUser.displayName,
                    role: seedUser.role,
                    passwordHash: mockPasswordHash(seedUser.password),
                    expiresAt: EPOCH_TTL_DISABLED,
                }),
            ),
        );
        return;
    }

    const adminPair = readEnvRequiredIfPair(
        "SEED_ADMIN_DISPLAY_NAME",
        "SEED_ADMIN_PASSWORD",
    );
    if (adminPair) {
        await userRepository.saveUser({
            userId: `admin:${adminPair.displayName.toLowerCase()}`,
            displayName: adminPair.displayName,
            role: "admin",
            passwordHash: mockPasswordHash(adminPair.password),
            expiresAt: EPOCH_TTL_DISABLED,
        });
    }

    const moderatorPair = readEnvRequiredIfPair(
        "SEED_MODERATOR_DISPLAY_NAME",
        "SEED_MODERATOR_PASSWORD",
    );
    if (moderatorPair) {
        await userRepository.saveUser({
            userId: `moderator:${moderatorPair.displayName.toLowerCase()}`,
            displayName: moderatorPair.displayName,
            role: "moderator",
            passwordHash: mockPasswordHash(moderatorPair.password),
            expiresAt: EPOCH_TTL_DISABLED,
        });
    }
}

function parseSeedUsersJson(seedUsersJson: string): unknown {
    try {
        return JSON.parse(seedUsersJson);
    } catch (error) {
        throw new Error(
            `SEED_USERS_JSON must be valid JSON: ${
                error instanceof Error ? error.message : "unknown parse error"
            }`,
        );
    }
}

function isRole(value: unknown): value is Role {
    return value === "guest" || value === "moderator" || value === "admin";
}

function validateSeedUsers(parsed: unknown): SeedUserConfig[] {
    if (!Array.isArray(parsed)) {
        throw new Error("SEED_USERS_JSON must be a JSON array");
    }

    const normalizedNames = new Set<string>();
    const validated: SeedUserConfig[] = [];

    parsed.forEach((entry, index) => {
        if (typeof entry !== "object" || entry === null) {
            throw new Error(`SEED_USERS_JSON[${index}] must be an object`);
        }

        const maybeDisplayName = (entry as { displayName?: unknown }).displayName;
        const maybePassword = (entry as { password?: unknown }).password;
        const maybeRole = (entry as { role?: unknown }).role;

        if (typeof maybeDisplayName !== "string" || !maybeDisplayName.trim()) {
            throw new Error(
                `SEED_USERS_JSON[${index}].displayName must be a non-empty string`,
            );
        }
        if (typeof maybePassword !== "string" || !maybePassword.trim()) {
            throw new Error(
                `SEED_USERS_JSON[${index}].password must be a non-empty string`,
            );
        }
        if (!isRole(maybeRole)) {
            throw new Error(
                `SEED_USERS_JSON[${index}].role must be one of: guest, moderator, admin`,
            );
        }

        const normalized = maybeDisplayName.trim().toLowerCase();
        if (normalizedNames.has(normalized)) {
            throw new Error(
                `SEED_USERS_JSON has duplicate displayName: "${maybeDisplayName.trim()}"`,
            );
        }
        normalizedNames.add(normalized);

        validated.push({
            displayName: maybeDisplayName.trim(),
            password: maybePassword.trim(),
            role: maybeRole,
        });
    });

    return validated;
}

async function getConnectedContext(connectionId: string): Promise<{
    room: Room;
    user: User;
    connection: Connection;
} | null> {
    const connection = await connectionRepository.getConnection(connectionId);
    if (!connection) {
        return null;
    }

    const [room, user] = await Promise.all([
        roomRepository.getRoom(connection.roomId),
        userRepository.getUserById(connection.userId),
    ]);

    if (!room || !user) {
        return null;
    }

    return { room, user, connection };
}

function fail<T>(ack: AckFn<T> | undefined, error: string): void {
    if (ack) {
        ack({ ok: false, error });
    }
}

function ok<T>(ack: AckFn<T> | undefined, data?: T): void {
    if (!ack) {
        return;
    }
    if (typeof data === "undefined") {
        ack({ ok: true });
        return;
    }
    ack({ ok: true, data });
}

app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", roomId: DEFAULT_ROOM_ID });
});

io.on("connection", (socket) => {
    socket.on(
        "joinRoom",
        async (
            payload: JoinRoomPayload,
            ack?: AckFn<{ room: Room; user: User }>,
        ) => {
            const displayName = normalizeDisplayName(payload.displayName ?? "");
            if (!displayName) {
                fail(ack, "displayName is required");
                return;
            }

            const roomId = payload.roomId?.trim() || DEFAULT_ROOM_ID;
            const room = await roomRepository.getRoom(roomId);
            if (!room) {
                fail(ack, "room does not exist");
                return;
            }

            let user = await userRepository.getUserByDisplayName(displayName);
            if (user) {
                if (user.passwordHash && !payload.password) {
                    fail(ack, "password is required for this account");
                    return;
                }
                if (
                    user.passwordHash &&
                    !compareMockPassword(
                        payload.password ?? "",
                        user.passwordHash,
                    )
                ) {
                    fail(ack, "invalid credentials");
                    return;
                }
            } else {
                user = createGuestUser(
                    userIdFromGuestName(displayName),
                    displayName,
                    EPOCH_TTL_DISABLED,
                );
                await userRepository.saveUser(user);
            }

            if (isBanned(room, user.userId)) {
                fail(ack, "user is banned in this room");
                return;
            }

            const roomConnections =
                await connectionRepository.listConnectionsInRoom(roomId);
            const hasActiveIdentity = roomConnections.some(
                (connection) => connection.userId === user.userId,
            );
            if (hasActiveIdentity) {
                fail(ack, "displayName is already in use");
                return;
            }

            await connectionRepository.saveConnection({
                connectionId: socket.id,
                roomId,
                userId: user.userId,
                connectedAt: Math.floor(Date.now() / 1000),
            });

            await socket.join(roomId);
            io.to(roomId).emit("presenceChanged", {
                userId: user.userId,
                connected: true,
            });
            ok(ack, { room, user });
        },
    );

    socket.on("becomeLeader", async (ack?: AckFn<{ room: Room }>) => {
        const context = await getConnectedContext(socket.id);
        if (!context) {
            fail(ack, "connection is not joined");
            return;
        }

        const updatedRoom = applyBecomeLeader(context.room, {
            requestingUser: context.user,
        });
        if (!updatedRoom) {
            fail(ack, "becomeLeader rejected by domain rules");
            return;
        }

        await roomRepository.saveRoom(updatedRoom);
        io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
        ok(ack, { room: updatedRoom });
    });

    socket.on(
        "setActiveVideo",
        async (payload: SetActiveVideoPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            if (context.room.playback.leaderUserId !== context.user.userId) {
                fail(ack, "only leader can set active video");
                return;
            }

            const updatedRoom: Room = {
                ...context.room,
                playback: {
                    ...context.room.playback,
                    videoId: payload.videoId,
                    currentTime: 0,
                    paused: true,
                },
            };

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "mediaUpdate",
        async (payload: MediaUpdatePayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const updatedRoom = applyMediaUpdate(context.room, {
                requestingUser: context.user,
                videoId: payload.videoId,
                currentTime: payload.currentTime,
                paused: payload.paused,
            });

            if (!updatedRoom) {
                fail(ack, "mediaUpdate rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on("chatMsg", async (payload: ChatMsgPayload, ack?: AckFn) => {
        const context = await getConnectedContext(socket.id);
        if (!context) {
            fail(ack, "connection is not joined");
            return;
        }

        if (isBanned(context.room, context.user.userId)) {
            fail(ack, "banned users cannot send chat messages");
            return;
        }

        const message = applyChatMessage({
            requestingUser: context.user,
            message: {
                fromUserId: context.user.userId,
                fromDisplayName: context.user.displayName,
                text: payload.text ?? "",
                sentAt: Math.floor(Date.now() / 1000),
            },
        });

        if (!message) {
            fail(ack, "chat message rejected by domain rules");
            return;
        }

        io.to(context.room.roomId).emit("chatMsg", message);
        ok(ack);
    });

    socket.on(
        "kick",
        async (payload: TargetUserPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const targetUser = await userRepository.getUserById(
                payload.targetUserId,
            );
            if (!targetUser) {
                fail(ack, "target user does not exist");
                return;
            }

            const roomConnections =
                await connectionRepository.listConnectionsInRoom(
                    context.room.roomId,
                );
            const targetConnection = roomConnections.find(
                (connection) => connection.userId === payload.targetUserId,
            );

            if (!targetConnection) {
                fail(ack, "target user is not connected to this room");
                return;
            }

            const result = applyKick(context.room, {
                requestingUser: context.user,
                kickedUser: targetUser,
                kickedUserConnection: targetConnection,
            });

            if (!result) {
                fail(ack, "kick rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(result.updatedRoom);
            await connectionRepository.deleteConnection(
                targetConnection.connectionId,
            );
            io.sockets.sockets
                .get(targetConnection.connectionId)
                ?.disconnect(true);
            io.to(context.room.roomId).emit("roomState", {
                room: result.updatedRoom,
            });
            ok(ack, { room: result.updatedRoom });
        },
    );

    socket.on(
        "ban",
        async (payload: TargetUserPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const targetUser = await userRepository.getUserById(
                payload.targetUserId,
            );
            if (!targetUser) {
                fail(ack, "target user does not exist");
                return;
            }

            const banEntry: BanEntry = {
                bannedUserId: targetUser.userId,
                bannedDisplayName: targetUser.displayName,
                bannedByUserId: context.user.userId,
                bannedAt: Math.floor(Date.now() / 1000),
            };

            const updatedRoom = applyBan(context.room, {
                requestingUser: context.user,
                bannedUser: banEntry,
            });

            if (!updatedRoom) {
                fail(ack, "ban rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            const roomConnections =
                await connectionRepository.listConnectionsInRoom(
                    context.room.roomId,
                );
            const targetConnections = roomConnections.filter(
                (connection) => connection.userId === targetUser.userId,
            );
            await Promise.all(
                targetConnections.map(async (targetConnection) => {
                    await connectionRepository.deleteConnection(
                        targetConnection.connectionId,
                    );
                    io.sockets.sockets
                        .get(targetConnection.connectionId)
                        ?.disconnect(true);
                }),
            );

            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "unban",
        async (payload: TargetUserPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const banEntry = context.room.bans.find(
                (entry) => entry.bannedUserId === payload.targetUserId,
            );
            if (!banEntry) {
                fail(ack, "target user is not banned");
                return;
            }

            const updatedRoom = applyUnban(context.room, {
                requestingUser: context.user,
                unbannedUser: banEntry,
            });

            if (!updatedRoom) {
                fail(ack, "unban rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "grantModerator",
        async (payload: TargetUserPayload, ack?: AckFn<{ user: User }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const targetUser = await userRepository.getUserById(
                payload.targetUserId,
            );
            if (!targetUser) {
                fail(ack, "target user does not exist");
                return;
            }

            const updatedUser = applyGrantModerator({
                requestingUser: context.user,
                grantedModeratorUser: targetUser,
            });
            if (!updatedUser) {
                fail(ack, "grantModerator rejected by domain rules");
                return;
            }

            await userRepository.saveUser(updatedUser);
            io.to(context.room.roomId).emit("userRoleUpdated", {
                userId: updatedUser.userId,
                role: updatedUser.role,
            });
            ok(ack, { user: updatedUser });
        },
    );

    socket.on(
        "revokeModerator",
        async (payload: TargetUserPayload, ack?: AckFn<{ user: User }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const targetUser = await userRepository.getUserById(
                payload.targetUserId,
            );
            if (!targetUser) {
                fail(ack, "target user does not exist");
                return;
            }

            const updatedUser = applyRevokeModerator({
                requestingUser: context.user,
                revokedModeratorUser: targetUser,
            });
            if (!updatedUser) {
                fail(ack, "revokeModerator rejected by domain rules");
                return;
            }

            await userRepository.saveUser(updatedUser);
            io.to(context.room.roomId).emit("userRoleUpdated", {
                userId: updatedUser.userId,
                role: updatedUser.role,
            });
            ok(ack, { user: updatedUser });
        },
    );

    socket.on("disconnect", async () => {
        const connection = await connectionRepository.getConnection(socket.id);
        if (!connection) {
            return;
        }

        const room = await roomRepository.getRoom(connection.roomId);
        if (room && room.playback.leaderUserId === connection.userId) {
            const updatedRoom = {
                ...room,
                playback: {
                    ...room.playback,
                    leaderUserId: null,
                },
            };
            await roomRepository.saveRoom(updatedRoom);
            io.to(room.roomId).emit("roomState", { room: updatedRoom });
        }

        await connectionRepository.deleteConnection(connection.connectionId);
        io.to(connection.roomId).emit("presenceChanged", {
            userId: connection.userId,
            connected: false,
        });
    });
});

async function bootstrap(): Promise<void> {
    await ensureMainRoom();
    await seedMockAccounts();

    const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
    server.listen(port, () => {
        console.log(`Socket server listening on http://localhost:${port}`);
    });
}

void bootstrap();
