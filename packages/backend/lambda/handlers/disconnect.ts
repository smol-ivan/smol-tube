import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { roomRepo, connectionRepo } from "../state";
import { broadcastToRoom } from "../utils/broadcast";


export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
    const connectionId = event.requestContext.connectionId;

    const connection = await connectionRepo.getConnection(connectionId);
    if (!connection) return { statusCode: 200 };

    const room = await roomRepo.getRoom(connection.roomId);

    // Si el usuario desconectado era el leader, lo liberamos
    if (room && room.playback.leaderUserId === connection.userId) {
        const updatedRoom = {
            ...room,
            playback: { ...room.playback, leaderUserId: null },
        };
        await roomRepo.saveRoom(updatedRoom);
        await broadcastToRoom(room.roomId, "roomUpdated", updatedRoom);
    }

    await connectionRepo.deleteConnection(connectionId);

    return { statusCode: 200 };
};
