import { Server, Socket } from "socket.io";
import { Room, User, createGuestUser, isBanned } from "@smol-tube/domain";
import { JoinRoomPayload, AckFn } from "../types";
import { normalizeDisplayName, compareMockPassword, userIdFromGuestName, fail, ok } from "../utils";
import { roomRepository, userRepository, connectionRepository } from "../state";
import { DEFAULT_ROOM_ID, EPOCH_TTL_DISABLED } from "../seed";

export function handleConnectionEvents(io: Server, socket: Socket) {
    socket.on(
        "joinRoom",
        async (
            payload: JoinRoomPayload,
            ack?: AckFn<{ room: Room; user: User; connectedUsers: Array<{ userId: string; displayName: string; role: string }> }>,
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

            const providedPassword = payload.password?.trim() ?? "";
            let user = await userRepository.getUserByDisplayName(displayName);
            if (user) {
                if (user.passwordHash && !providedPassword) {
                    fail(ack, "password is required for this account");
                    return;
                }
                if (
                    user.passwordHash &&
                    !compareMockPassword(
                        providedPassword,
                        user.passwordHash,
                    )
                ) {
                    fail(ack, "invalid credentials");
                    return;
                }
            } else {
                if (providedPassword) {
                    fail(ack, "invalid credentials");
                    return;
                }
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
                displayName: user.displayName,
                connected: true,
            });

            // Build connectedUsers list (includes the user that just joined)
            const allConnections = await connectionRepository.listConnectionsInRoom(roomId);
            const connectedUsersList = await Promise.all(
                allConnections.map(async (conn) => {
                    const u = await userRepository.getUserById(conn.userId);
                    return u
                        ? { userId: u.userId, displayName: u.displayName, role: u.role as string }
                        : null;
                }),
            );
            const connectedUsers = connectedUsersList.filter(
                (u): u is { userId: string; displayName: string; role: string } => u !== null,
            );

            ok(ack, { room, user, connectedUsers });
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
            displayName: (await userRepository.getUserById(connection.userId))?.displayName ?? null,
            connected: false,
        });
    });
}
