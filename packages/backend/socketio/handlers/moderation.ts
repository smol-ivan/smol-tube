import { Server, Socket } from "socket.io";
import { Room, User, applyKick, applyBan, applyUnban, applyGrantModerator, applyRevokeModerator, BanEntry } from "@smol-tube/domain";
import { AckFn, TargetUserPayload } from "../types";
import { getConnectedContext, fail, ok } from "../utils";
import { roomRepository, userRepository, connectionRepository } from "../state";

export function handleModerationEvents(io: Server, socket: Socket) {
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
}
