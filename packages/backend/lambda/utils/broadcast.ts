import { apiGw, connectionRepo } from "../state";
import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

export async function broadcastToRoom(
    roomId: string,
    action: string,
    data: any,
) {
    const connections = await connectionRepo.listConnectionsInRoom(roomId);

    const promises = connections.map(async (conn) => {
        try {
            await apiGw.send(
                new PostToConnectionCommand({
                    ConnectionId: conn.connectionId,
                    Data: Buffer.from(JSON.stringify({ action, data })),
                }),
            );
        } catch (e: any) {
            // Error 410 Gone: El cliente cerró la conexión abruptamente
            if (e.$metadata?.httpStatusCode === 410) {
                await connectionRepo.deleteConnection(conn.connectionId);
            }
        }
    });

    await Promise.all(promises);
}
