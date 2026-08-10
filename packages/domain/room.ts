// domain/room.ts
//
// El estado de TU ÚNICA sala (recuerda: decidiste no manejar canales
// múltiples, solo una sala principal). Aun así modelamos "roomId" para
// no cerrarnos la puerta si algún día quisieras más de una, pero en la
// práctica hoy siempre sería el mismo valor fijo (ej. "main").

export interface PlaybackState {
    videoId: string | null; // null = no hay nada cargado
    currentTime: number; // segundos
    paused: boolean;
    // Quién tiene autoridad para mandar mediaUpdate/jumpTo/playNext.
    // Replica exactamente la regla de CyTube: solo el leader puede
    // mover el estado de reproducción; el resto solo lo recibe.
    leaderUserId: string | null;
}

export interface PlaylistItem {
    itemId: string; // id propio del item en la cola (no el videoId)
    videoId: string;
    title: string;
    thumbnailUrl?: string; // miniatura obtenida desde YouTube Data API (o construida desde videoId)
    addedByUserId: string;
    durationSeconds: number;
}

// Un ban es sobre la IDENTIDAD (nombre de invitado o userId de cuenta),
// no sobre una Connection -- si solo baneas la conexión, la persona
// puede reconectarse y listo, lo cual anula el propósito del ban.
export interface BanEntry {
    bannedUserId: string;
    bannedDisplayName: string; // para mostrar en el panel de moderación
    bannedByUserId: string;
    bannedAt: number; // epoch seconds
}

export interface Room {
    roomId: string;

    playback: PlaybackState;

    playlist: PlaylistItem[];

    history: PlaylistItem[];

    skipVotes: string[];

    bans: BanEntry[];

    // TTL de producción (ver nota en user.ts). En desarrollo local se
    // puede ignorar o usarse solo para limpiar en un cron manual.
    expiresAt: number | null;
}

export function createEmptyRoom(
    roomId: string,
    expiresAt: number | null,
): Room {
    return {
        roomId,
        playback: {
            videoId: null,
            currentTime: 0,
            paused: true,
            leaderUserId: null,
        },
        playlist: [],
        history: [],
        skipVotes: [],
        bans: [],
        expiresAt,
    };
}

export function isBanned(room: Room, userId: string): boolean {
    return room.bans.some((b) => b.bannedUserId === userId);
}
