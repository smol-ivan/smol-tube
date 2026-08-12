import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { roomRepo } from "../state";
import { applyPlaylistPlay } from "@smol-tube/domain";

export const handler = withContext(async ({ room, user, payload }) => {
    const updatedRoom = applyPlaylistPlay(room, {
        requestingUser: user,
        itemId: payload.itemId,
    });
    if (!updatedRoom) return { statusCode: 403 };

    await roomRepo.saveRoom(updatedRoom);
    await broadcastToRoom(room.roomId, "roomState", { room: updatedRoom });
    return { statusCode: 200 };
});
