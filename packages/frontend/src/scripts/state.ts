// src/state.ts
import { WSClient } from "./wsClient";
import type { ConnectedUser, ChatMsg, PlaylistItem } from "./types"; //

// Coloca aquí la URL wss:// que te dio AWS SAM al final del despliegue
const SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL;

if (!SOCKET_URL) {
    throw new Error("PUBLIC_SOCKET_URL is not configured");
}

const wsClient = new WSClient(SOCKET_URL);

export const state = {
    socket: wsClient, // Reemplazamos io() por nuestra clase custom
    connected: false, //
    displayName: "", //[cite: 9]
    currentUserId: "", //[cite: 9]
    currentRole: "", //[cite: 9]
    users: [] as ConnectedUser[], //[cite: 9]
    chat: [] as ChatMsg[], //[cite: 9]
    playlist: [] as PlaylistItem[], //[cite: 9]
    history: [] as PlaylistItem[], //[cite: 9]
    skipVotes: [] as string[], //[cite: 9]
    playback: {
        //[cite: 9]
        videoId: null as string | null, //[cite: 9]
        currentTime: 0, //[cite: 9]
        paused: true, //[cite: 9]
        leaderUserId: null as string | null, //[cite: 9]
    },
};
