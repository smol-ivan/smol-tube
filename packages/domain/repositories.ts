// domain/repositories.ts
//
// These interfaces are the contract between domain/ and wherever the
// state actually lives. domain/ (and the adapters' handlers) only know
// these signatures -- they never import "Map", "aws-sdk" or anything
// concrete.
//
// Design rule: every method must make sense implemented both by an
// in-memory Map (local development) and by DynamoDB (production). A
// method that only makes sense in one of them doesn't belong here.
//
// That's why there is no "runTransaction" (an SQL idea) and no
// unfiltered "scanAll" (expensive in DynamoDB, free in a Map -- the
// design assumes DynamoDB's costs apply to the Map too).

import { Room } from "./room";
import { User } from "./user";
import { Connection } from "./connection";

export interface RoomRepository {
    getRoom(roomId: string): Promise<Room | null>;

    // Saves the whole Room. Simplicity first: no partial updates here
    // (a concrete implementation can optimize later, e.g. with a
    // DynamoDB UpdateExpression) -- domain/ always works with the
    // complete Room object, like the pure functions in playback-rules.ts.
    saveRoom(room: Room): Promise<void>;

    deleteRoom(roomId: string): Promise<void>;
}

export interface UserRepository {
    getUserById(userId: string): Promise<User | null>;

    // Necesario porque los invitados se identifican por nombre al
    // entrar (no por userId, que ni conocen todavía), y porque
    // validar cuentas con contraseña también parte del nombre que la
    // persona escribe en el formulario de login.
    getUserByDisplayName(displayName: string): Promise<User | null>;

    saveUser(user: User): Promise<void>;

    deleteUser(userId: string): Promise<void>;
}

export interface ConnectionRepository {
    getConnection(connectionId: string): Promise<Connection | null>;

    // La operación más importante de todas para la sincronización:
    // "¿a quién le hago broadcast?". Tanto un Map (filtrando por
    // roomId) como una GSI de Dynamo (consultando por roomId) resuelven
    // esto igual de bien -- por eso vive aquí como método de primera
    // clase, no como un detalle de implementación.
    listConnectionsInRoom(roomId: string): Promise<Connection[]>;

    saveConnection(connection: Connection): Promise<void>;

    deleteConnection(connectionId: string): Promise<void>;
}
