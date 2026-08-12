import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { roomRepo } from "../state";
import { applyMediaUpdate } from "@smol-tube/domain";

export const handler = withContext(async ({ room, user, payload }) => {
    // Validar que el usuario que actualiza tiene el control maestro
    if (room.playback.leaderUserId !== user.userId) {
        return { statusCode: 403 };
    }

    // Inyectamos explícitamente el requestingUser que el dominio exige
    const updatedRoom = applyMediaUpdate(room, {
        requestingUser: user,
        videoId: payload.videoId,
        currentTime: payload.currentTime,
        paused: payload.paused,
    });

    if (!updatedRoom) {
        return { statusCode: 400 };
    }

    await roomRepo.saveRoom(updatedRoom);

    // CRÍTICO: El frontend de smol-tube espera "roomState", no "mediaUpdate"
    await broadcastToRoom(room.roomId, "roomState", { room: updatedRoom });

    return { statusCode: 200 };
});
