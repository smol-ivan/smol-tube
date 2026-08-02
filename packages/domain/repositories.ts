// domain/repositories.ts
//
// Estas interfaces son el "contrato" que separan domain/ de dónde
// vive realmente el estado. domain/ (y los handlers de tus adapters)
// solo conocen estas firmas -- nunca importan "Map", ni "aws-sdk",
// ni nada concreto.
//
// Criterio de diseño: cada método debe tener sentido implementado
// tanto por un Map en memoria (desarrollo local) como por DynamoDB
// (producción). Si un método solo cobra sentido en uno de los dos
// mundos, no pertenece aquí.
//
// Por eso, por ejemplo, NO hay un método tipo "runTransaction" (tiene
// sentido en SQL, no aquí) ni un método tipo "scanAll sin filtro"
// (DynamoDB lo penaliza fuerte, un Map lo soporta gratis -- preferimos
// diseñar como si el costo de Dynamo también aplicara al Map).

import { Room } from "./room";
import { User } from "./user";
import { Connection } from "./connection";

export interface RoomRepository {
  getRoom(roomId: string): Promise<Room | null>;

  // Guarda el Room completo. Simplicidad ante todo: no manejamos
  // updates parciales aquí (eso lo puede resolver la implementación
  // concreta si hace falta optimizar más adelante, ej. con
  // UpdateExpression de Dynamo) -- domain/ siempre trabaja con el
  // objeto Room completo, igual que ya hacen las funciones puras
  // que vimos en playback-rules.ts.
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
