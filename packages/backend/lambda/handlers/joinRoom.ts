import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { connectionRepo, roomRepo, userRepo } from "../state";
import { broadcastToRoom } from "../utils/broadcast";
import {
    User,
    Connection,
    createEmptyRoom,
    createGuestUser,
} from "@smol-tube/domain";
import { randomUUID } from "crypto";

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body ?? "{}");
    const payload = body.payload; // Ej: { roomId: "sala-test", displayName: "Ivan" }

    if (!payload.roomId || !payload.displayName) return { statusCode: 400 };

    let room = await roomRepo.getRoom(payload.roomId);
    if (!room) {
        // Inicializar sala si no existe
        room = createEmptyRoom(payload.roomId, null);
        await roomRepo.saveRoom(room);
    }

    const userId = randomUUID();
    const user: User = createGuestUser(userId, payload.displayName, null);
    await userRepo.saveUser(user);

    const connection: Connection = {
        connectionId,
        roomId: room!.roomId,
        userId: user.userId,
        connectedAt: Math.floor(Date.now() / 1000),
    };
    await connectionRepo.saveConnection(connection);

    await broadcastToRoom(room.roomId, "userJoined", { user });

    return { statusCode: 200 };
};
