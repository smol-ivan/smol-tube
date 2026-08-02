// adapters/repositories/InMemoryRoomRepository.ts
//
// Implementación para desarrollo local. Todo vive en un Map mientras
// el proceso Node esté vivo. Se pierde al reiniciar -- coherente con
// tu decisión de no persistir nada de verdad.

import { RoomRepository } from '@smol-tube/domain/repositories';
import { Room } from '@smol-tube/domain/room';

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
