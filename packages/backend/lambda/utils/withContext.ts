import { APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { User, Room, Connection } from "@smol-tube/domain";
import { connectionRepo, userRepo, roomRepo } from "../state";

export type HandlerContext = {
    connectionId: string;
    connection: Connection;
    room: Room;
    user: User;
    payload: any;
};

export function withContext(
    handlerLogic: (ctx: HandlerContext) => Promise<{ statusCode: number }>,
) {
    return async (event: APIGatewayProxyWebsocketEventV2) => {
        const connectionId = event.requestContext.connectionId;
        const body = event.body ? JSON.parse(event.body) : {};
        const payload = body.data || body.payload || {};

        const connection = await connectionRepo.getConnection(connectionId);
        if (!connection) return { statusCode: 403 };

        const [room, user] = await Promise.all([
            roomRepo.getRoom(connection.roomId),
            userRepo.getUserById(connection.userId),
        ]);

        if (!room || !user) return { statusCode: 404 };

        return handlerLogic({ connectionId, connection, room, user, payload });
    };
}
