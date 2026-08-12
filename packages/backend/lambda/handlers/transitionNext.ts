import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { roomRepo } from "../state";
import { applyTransitionToNext } from "@smol-tube/domain";

export const handler = withContext(async ({ room, user }) => {
    const updatedRoom = applyTransitionToNext(room, { requestingUser: user });
    if (!updatedRoom) return { statusCode: 403 };

    await roomRepo.saveRoom(updatedRoom);
    await broadcastToRoom(room.roomId, "roomState", { room: updatedRoom });
    return { statusCode: 200 };
});
