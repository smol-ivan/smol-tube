import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { User, UserRepository } from "@smol-tube/domain";

export class DynamoUserRepository implements UserRepository {
    private doc: DynamoDBDocumentClient;

    constructor(private tableName: string) {
        const client = new DynamoDBClient({});
        this.doc = DynamoDBDocumentClient.from(client);
    }

    async getUserById(userId: string): Promise<User | null> {
        const result = await this.doc.send(
            new GetCommand({
                TableName: this.tableName,
                Key: { userId },
            }),
        );
        return (result.Item as User) ?? null;
    }

    async saveUser(user: User): Promise<void> {
        await this.doc.send(
            new PutCommand({
                TableName: this.tableName,
                Item: user,
            }),
        );
    }
}
