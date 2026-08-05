import { AckFn } from "./types";
import { Room, User, Connection } from "@smol-tube/domain";
import { connectionRepository, roomRepository, userRepository } from "./state";

export function normalizeDisplayName(displayName: string): string {
    return displayName.trim();
}

export function userIdFromGuestName(displayName: string): string {
    return `guest:${displayName.toLowerCase().replace(/\s+/g, "-")}`;
}

export function mockPasswordHash(password: string): string {
    return `mock:${password}`;
}

export function compareMockPassword(password: string, hash: string | null): boolean {
    if (!hash) {
        return false;
    }
    return hash === mockPasswordHash(password);
}

export async function getConnectedContext(connectionId: string): Promise<{
    room: Room;
    user: User;
    connection: Connection;
} | null> {
    const connection = await connectionRepository.getConnection(connectionId);
    if (!connection) {
        return null;
    }

    const [room, user] = await Promise.all([
        roomRepository.getRoom(connection.roomId),
        userRepository.getUserById(connection.userId),
    ]);

    if (!room || !user) {
        return null;
    }

    return { room, user, connection };
}

export function fail<T>(ack: AckFn<T> | undefined, error: string): void {
    if (ack) {
        ack({ ok: false, error });
    }
}

export function ok<T>(ack: AckFn<T> | undefined, data?: T): void {
    if (!ack) {
        return;
    }
    if (typeof data === "undefined") {
        ack({ ok: true });
        return;
    }
    ack({ ok: true, data });
}
