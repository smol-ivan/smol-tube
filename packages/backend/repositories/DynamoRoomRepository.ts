// adapters/repositories/DynamoRoomRepository.ts
//
// Implementación de producción. Misma interfaz que
// InMemoryRoomRepository -- domain/ y los handlers de Lambda no
// pueden distinguir cuál está detrás.
//
// Diseño de tabla (lo veremos a detalle cuando lleguemos a esa etapa,
// aquí solo lo mínimo para que este archivo tenga sentido):
//   Tabla: Rooms
//   Partition key: roomId (string)
//   Atributo "data": el Room completo serializado como JSON
//   Atributo "expiresAt": epoch seconds, configurado como TTL de la tabla

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Room, RoomRepository } from "@smol-tube/domain";

export class DynamoRoomRepository implements RoomRepository {
    private doc: DynamoDBDocumentClient;
    private tableName: string;

    constructor(tableName: string) {
        const client = new DynamoDBClient({});
        this.doc = DynamoDBDocumentClient.from(client);
        this.tableName = tableName;
    }

    async getRoom(roomId: string): Promise<Room | null> {
        const result = await this.doc.send(new GetCommand({
            TableName: this.tableName,
            Key: { roomId },
        }));

        return (result.Item?.data as Room) ?? null;
    }

    async saveRoom(room: Room): Promise<void> {
        await this.doc.send(new PutCommand({
            TableName: this.tableName,
            Item: {
                roomId: room.roomId,
                data: room,
                expiresAt: room.expiresAt ?? undefined,
            },
        }));
    }

    async deleteRoom(roomId: string): Promise<void> {
        await this.doc.send(new DeleteCommand({
            TableName: this.tableName,
            Key: { roomId },
        }));
    }
}
