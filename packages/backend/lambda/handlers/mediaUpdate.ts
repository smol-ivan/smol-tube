import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { roomRepo } from "../state";
import { applyMediaUpdate } from "@smol-tube/domain";

export const handler = withContext(async ({ room, user, payload }) => {
    // Validar que el usuario que actualiza tiene el control maestro
    if (room.playback.leaderUserId !== user.userId) {
        return { statusCode: 403 };
    }

    const updatedRoom = applyMediaUpdate(room, payload);
    if (!updatedRoom) {
        return { statusCode: 400 };
    }

    // Persistir en base de datos
    await roomRepo.saveRoom(updatedRoom);

    // Hacer broadcast de los cambios a todos los sockets conectados a la sala
    await broadcastToRoom(room.roomId, "mediaUpdate", updatedRoom.playback);

    return { statusCode: 200 };
});
