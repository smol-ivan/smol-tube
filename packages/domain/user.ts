// domain/user.ts
//
// Representa QUIÉN es alguien, independiente de su conexión física
// (socket/WebSocket). Un usuario puede ser invitado (sin cuenta) o
// tener cuenta con contraseña (moderador/admin).
//
// Esta entidad NO sabe nada de Socket.IO, DynamoDB, ni Lambda. Es pura.

export type Role = "guest" | "moderator" | "admin";

// Jerarquía simple: cada rol superior incluye implícitamente los
// permisos del anterior, pero preferimos listar permisos explícitos
// por rol en vez de calcular "admin > moderator > guest" en runtime.
// Es más verboso, pero más fácil de auditar y de testear: ves de un
// vistazo qué puede hacer cada rol sin tener que razonar jerarquías.
export type Permission =
    | "chat:send"
    | "playback:control" // play, pausa, seek (si eres el leader)
    | "playback:becomeLeader" // tomar el control de reproducción
    | "playlist:add"
    | "playlist:remove"
    | "playlist:reorder"
    | "moderation:kick"
    | "moderation:ban"
    | "moderation:unban"
    | "roles:grantModerator"
    | "roles:revokeModerator";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    guest: ["chat:send", "playback:becomeLeader"],
    moderator: [
        "chat:send",
        "playback:control",
        "playback:becomeLeader",
        "playlist:add",
        "playlist:remove",
        "playlist:reorder",
        "moderation:kick",
        "moderation:ban",
        "moderation:unban",
    ],
    admin: [
        "chat:send",
        "playback:control",
        "playback:becomeLeader",
        "playlist:add",
        "playlist:remove",
        "playlist:reorder",
        "moderation:kick",
        "moderation:ban",
        "moderation:unban",
        "roles:grantModerator",
        "roles:revokeModerator",
    ],
};

export interface User {
    // Identificador estable de la IDENTIDAD, no de la conexión.
    // Para invitados: se deriva del nombre elegido al entrar (ver nota
    // más abajo sobre colisiones). Para cuentas: es el username fijo.
    userId: string;

    displayName: string;

    role: Role;

    // Cuentas con contraseña (moderador/admin sembrados) tienen esto;
    // los invitados no.
    passwordHash: string | null;

    // Para producción (DynamoDB): epoch seconds en que este registro
    // debe autodestruirse si nadie lo usa. En desarrollo local
    // (en memoria) se ignora, o se usa solo para limpiar si quieres
    // simular el mismo comportamiento.
    expiresAt: number | null;
}

export function hasPermission(user: User, permission: Permission): boolean {
    return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function createGuestUser(
    userId: string,
    displayName: string,
    expiresAt: number | null,
): User {
    return {
        userId,
        displayName,
        role: "guest",
        passwordHash: null,
        expiresAt,
    };
}

// Nota de diseño: un invitado "es" su nombre para efectos de ban (ver
// ban.ts). Si dos invitados eligen el mismo nombre, es una colisión que
// debe resolverse en la capa de adapter (ej. rechazar el nombre si ya
// está en uso en esa sala), no aquí en domain/.
