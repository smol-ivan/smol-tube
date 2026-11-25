// adapters/repositories/InMemoryRoomRepository.ts
//
// Local development implementation. Everything lives in a Map for as
// long as the Node process runs and is lost on restart, which matches
// the project's choice of not persisting anything long-term.

import { Room, RoomRepository } from "@smol-tube/domain";

export class InMemoryRoomRepository implements RoomRepository {
    private rooms = new Map<string, Room>();

    async getRoom(roomId: string): Promise<Room | null> {
        return this.rooms.get(roomId) ?? null;
    }

    async saveRoom(room: Room): Promise<void> {
        this.rooms.set(room.roomId, room);
    }

    async deleteRoom(roomId: string): Promise<void> {
        this.rooms.delete(roomId);
    }
}
