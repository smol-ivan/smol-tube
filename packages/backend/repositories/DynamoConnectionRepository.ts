import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    DeleteCommand,
    QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Connection, ConnectionRepository } from "@smol-tube/domain";

export class DynamoConnectionRepository implements ConnectionRepository {
    private doc: DynamoDBDocumentClient;

    constructor(private tableName: string) {
        const client = new DynamoDBClient({});
        this.doc = DynamoDBDocumentClient.from(client);
    }

    async getConnection(connectionId: string): Promise<Connection | null> {
        const result = await this.doc.send(
            new GetCommand({
                TableName: this.tableName,
                Key: { connectionId },
            }),
        );
        return (result.Item as Connection) ?? null;
    }

    async saveConnection(connection: Connection): Promise<void> {
        // En Dynamo, puedes configurar el TTL usando el atributo expiresAt
        await this.doc.send(
            new PutCommand({
                TableName: this.tableName,
                Item: { ...connection },
            }),
        );
    }

    async deleteConnection(connectionId: string): Promise<void> {
        await this.doc.send(
            new DeleteCommand({
                TableName: this.tableName,
                Key: { connectionId },
            }),
        );
    }

    async listConnectionsInRoom(roomId: string): Promise<Connection[]> {
        // Asume que tienes un Global Secondary Index (GSI) llamado "RoomIndex"
        // con roomId como Partition Key.
        const result = await this.doc.send(
            new QueryCommand({
                TableName: this.tableName,
                IndexName: "RoomIndex",
                KeyConditionExpression: "roomId = :rId",
                ExpressionAttributeValues: { ":rId": roomId },
            }),
        );
        return (result.Items as Connection[]) ?? [];
    }
}
