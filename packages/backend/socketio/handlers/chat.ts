import { Server, Socket } from "socket.io";
import { applyChatMessage, isBanned } from "@smol-tube/domain";
import { AckFn, ChatMsgPayload } from "../types";
import { getConnectedContext, fail, ok } from "../utils";

export function handleChatEvents(io: Server, socket: Socket) {
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
}
