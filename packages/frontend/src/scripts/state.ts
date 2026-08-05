import { io } from "socket.io-client";
import type { ConnectedUser, ChatMsg, PlaylistItem } from "./types";

const SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL ?? "http://localhost:3000";

export const state = {
    socket: io(SOCKET_URL, { autoConnect: false }),
    connected: false,
    displayName: "",
    currentUserId: "",
    currentRole: "",
    users: [] as ConnectedUser[],
    chat: [] as ChatMsg[],
    playlist: [] as PlaylistItem[],
    playback: {
        videoId: null as string | null,
        currentTime: 0,
        paused: true,
        leaderUserId: null as string | null,
    },
};
