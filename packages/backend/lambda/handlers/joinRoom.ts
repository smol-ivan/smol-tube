import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { connectionRepo, roomRepo, userRepo, apiGw } from "../state";
import { broadcastToRoom } from "../utils/broadcast";
import {
    User,
    Connection,
    createEmptyRoom,
    createGuestUser,
} from "@smol-tube/domain";
import { randomUUID } from "crypto";
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body ?? "{}");
    const payload = body.payload; // { roomId, displayName, password }

    if (!payload.roomId || !payload.displayName) return { statusCode: 400 };

    let room = await roomRepo.getRoom(payload.roomId);
    if (!room) {
        room = createEmptyRoom(payload.roomId, null);
        await roomRepo.saveRoom(room);
    }

    // --- LÓGICA DE AUTENTICACIÓN ---
    let user: User;

    // Verificamos si envió la contraseña de admin (puedes expandir esto luego a DynamoDB)
    if (payload.password === "admin123") {
        user = {
            userId: "admin-fixed-id", // ID fijo para no crear múltiples admins
            displayName: payload.displayName,
            role: "admin",
            passwordHash: "mock:admin123",
            expiresAt: null,
        };
        await userRepo.saveUser(user);
    } else {
        const userId = randomUUID();
        user = createGuestUser(userId, payload.displayName, null);
        await userRepo.saveUser(user);
    }

    // 1. Guardar la conexión
    const connection: Connection = {
        connectionId,
        roomId: room.roomId,
        userId: user.userId,
        connectedAt: Math.floor(Date.now() / 1000),
    };
    await connectionRepo.saveConnection(connection);

    // 2. Obtener usuarios conectados para el frontend
    const allConnections = await connectionRepo.listConnectionsInRoom(
        room.roomId,
    );
    const connectedUsersList = await Promise.all(
        allConnections.map(async (conn) => {
            const u = await userRepo.getUserById(conn.userId);
            return u
                ? { userId: u.userId, displayName: u.displayName, role: u.role }
                : null;
        }),
    );
    const connectedUsers = connectedUsersList.filter((u) => u !== null);

    // 3. Responder ÉXITO directo al cliente (reemplaza al callback antiguo)
    await apiGw.send(
        new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(
                JSON.stringify({
                    action: "joinRoomSuccess",
                    data: { room, user, connectedUsers },
                }),
            ),
        }),
    );

    // 4. Avisar al RESTO de la sala que alguien entró
    await broadcastToRoom(room.roomId, "presenceChanged", {
        userId: user.userId,
        displayName: user.displayName,
        connected: true,
    });

    return { statusCode: 200 };
};
