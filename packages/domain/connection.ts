// domain/connection.ts
//
// Representa el socket/WebSocket físico de alguien conectado a una
// sala. Deliberadamente separado de User: la Connection puede
// desaparecer (kick, cierre de pestaña) sin que la identidad deje de
// existir (por ejemplo, para un admin con cuenta que se reconecta).

export interface Connection {
    // En Socket.IO local: socket.id
    // En Lambda/API Gateway: event.requestContext.connectionId
    connectionId: string;

    roomId: string;

    userId: string; // referencia a User.userId

    connectedAt: number; // epoch seconds, útil para debug/orden de llegada
}
