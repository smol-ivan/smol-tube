import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { roomRepo } from "../state";
import { applyPlaylistRemove } from "@smol-tube/domain";

export const handler = withContext(async ({ room, user, payload }) => {
    const targetItem = room.playlist.find(
        (item) => item.itemId === payload.itemId,
    );
    if (!targetItem) return { statusCode: 404 };

    const updatedRoom = applyPlaylistRemove(room, {
        requestingUser: user,
        removedVideo: targetItem,
    });
    if (!updatedRoom) return { statusCode: 403 };

    await roomRepo.saveRoom(updatedRoom);
    await broadcastToRoom(room.roomId, "roomState", { room: updatedRoom });
    return { statusCode: 200 };
});
