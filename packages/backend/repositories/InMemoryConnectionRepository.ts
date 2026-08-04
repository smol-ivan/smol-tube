import { Connection, ConnectionRepository } from "@smol-tube/domain";

export class InMemoryConnectionRepository implements ConnectionRepository {
    private connectionsById = new Map<string, Connection>();
    private connectionIdsByRoom = new Map<string, Set<string>>();

    async getConnection(connectionId: string): Promise<Connection | null> {
        return this.connectionsById.get(connectionId) ?? null;
    }

    async listConnectionsInRoom(roomId: string): Promise<Connection[]> {
        const connectionIds = this.connectionIdsByRoom.get(roomId);
        if (!connectionIds) {
            return [];
        }

        return [...connectionIds]
            .map((connectionId) => this.connectionsById.get(connectionId))
            .filter((connection): connection is Connection => Boolean(connection));
    }

    async saveConnection(connection: Connection): Promise<void> {
        const existing = this.connectionsById.get(connection.connectionId);
        if (existing && existing.roomId !== connection.roomId) {
            const existingRoomSet = this.connectionIdsByRoom.get(existing.roomId);
            existingRoomSet?.delete(existing.connectionId);
            if (existingRoomSet && existingRoomSet.size === 0) {
                this.connectionIdsByRoom.delete(existing.roomId);
            }
        }

        this.connectionsById.set(connection.connectionId, connection);

        let roomSet = this.connectionIdsByRoom.get(connection.roomId);
        if (!roomSet) {
            roomSet = new Set<string>();
            this.connectionIdsByRoom.set(connection.roomId, roomSet);
        }
        roomSet.add(connection.connectionId);
    }

    async deleteConnection(connectionId: string): Promise<void> {
        const existing = this.connectionsById.get(connectionId);
        if (existing) {
            const roomSet = this.connectionIdsByRoom.get(existing.roomId);
            roomSet?.delete(connectionId);
            if (roomSet && roomSet.size === 0) {
                this.connectionIdsByRoom.delete(existing.roomId);
            }
        }
        this.connectionsById.delete(connectionId);
    }
}
