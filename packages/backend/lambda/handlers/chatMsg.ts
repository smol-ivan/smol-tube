import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { applyChatMessage, isBanned } from "@smol-tube/domain";

export const handler = withContext(async ({ room, user, payload }) => {
    if (isBanned(room, user.userId)) return { statusCode: 403 };

    const message = applyChatMessage({
        requestingUser: user,
        message: {
            fromUserId: user.userId,
            fromDisplayName: user.displayName,
            text: payload.text ?? "",
            sentAt: Math.floor(Date.now() / 1000),
        },
    });

    if (!message) return { statusCode: 400 };

    await broadcastToRoom(room.roomId, "chatMsg", message);

    return { statusCode: 200 };
});
