import { Server, Socket } from "socket.io";
import { Room, applyPlaylistAdd, applyPlaylistRemove, applyPlaylistReorder } from "@smol-tube/domain";
import { AckFn, PlaylistAddPayload, PlaylistRemovePayload, PlaylistReorderPayload } from "../types";
import { getConnectedContext, fail, ok } from "../utils";
import { roomRepository } from "../state";
import crypto from "node:crypto";

export function handlePlaylistEvents(io: Server, socket: Socket) {
    socket.on(
        "playlistAdd",
        async (payload: PlaylistAddPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const updatedRoom = applyPlaylistAdd(context.room, {
                requestingUser: context.user,
                addedVideo: {
                    itemId: crypto.randomUUID(), // generate unique item ID for the playlist entry
                    videoId: payload.videoId,
                    title: payload.title,
                    addedByUserId: context.user.userId,
                    durationSeconds: payload.durationSeconds,
                }
            });

            if (!updatedRoom) {
                fail(ack, "playlistAdd rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "playlistRemove",
        async (payload: PlaylistRemovePayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const targetItem = context.room.playlist.find(item => item.itemId === payload.itemId);
            if (!targetItem) {
                fail(ack, "playlist item not found");
                return;
            }

            const updatedRoom = applyPlaylistRemove(context.room, {
                requestingUser: context.user,
                removedVideo: targetItem,
            });

            if (!updatedRoom) {
                fail(ack, "playlistRemove rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );

    socket.on(
        "playlistReorder",
        async (payload: PlaylistReorderPayload, ack?: AckFn<{ room: Room }>) => {
            const context = await getConnectedContext(socket.id);
            if (!context) {
                fail(ack, "connection is not joined");
                return;
            }

            const updatedRoom = applyPlaylistReorder(context.room, {
                requestingUser: context.user,
                fromIndex: payload.fromIndex,
                toIndex: payload.toIndex,
            });

            if (!updatedRoom) {
                fail(ack, "playlistReorder rejected by domain rules");
                return;
            }

            await roomRepository.saveRoom(updatedRoom);
            io.to(context.room.roomId).emit("roomState", { room: updatedRoom });
            ok(ack, { room: updatedRoom });
        },
    );
}
