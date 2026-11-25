// src/state.ts
import { WSClient } from "./wsClient";
import type { ConnectedUser, ChatMsg, PlaylistItem } from "./types";

// wss:// URL of the API Gateway WebSocket stage (the WebSocketURI output of the SAM stack)
const SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL;

if (!SOCKET_URL) {
    throw new Error("PUBLIC_SOCKET_URL is not configured");
}

const wsClient = new WSClient(SOCKET_URL);

export const state = {
    socket: wsClient, // Native WebSocket wrapper (replaced socket.io-client)
    connected: false,
    displayName: "",
    currentUserId: "",
    currentRole: "",
    users: [] as ConnectedUser[],
    chat: [] as ChatMsg[],
    playlist: [] as PlaylistItem[],
    history: [] as PlaylistItem[],
    skipVotes: [] as string[],
    playback: {
        videoId: null as string | null,
        currentTime: 0,
        paused: true,
        leaderUserId: null as string | null,
    },
};
