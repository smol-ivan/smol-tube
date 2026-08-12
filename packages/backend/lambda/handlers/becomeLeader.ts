import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { roomRepo } from "../state";
import { applyBecomeLeader } from "@smol-tube/domain";

export const handler = withContext(async ({ room, user }) => {
    const updatedRoom = applyBecomeLeader(room, {
        requestingUser: user,
    });

    if (!updatedRoom) {
        return { statusCode: 403 };
    }

    // Persistir y avisar a todos en la sala del nuevo leader
    await roomRepo.saveRoom(updatedRoom);
    await broadcastToRoom(room.roomId, "roomState", { room: updatedRoom });

    return { statusCode: 200 };
});
