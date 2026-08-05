import { Server, Socket } from "socket.io";
import { Room, applyBecomeLeader, applyMediaUpdate } from "@smol-tube/domain";
import { AckFn, MediaUpdatePayload, SetActiveVideoPayload } from "../types";
import { getConnectedContext, fail, ok } from "../utils";
import { roomRepository } from "../state";

export function handleMediaEvents(io: Server, socket: Socket) {
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
}
