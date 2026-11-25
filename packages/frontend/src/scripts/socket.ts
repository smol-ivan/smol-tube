// src/socket.ts
import { state } from "./state";
import { applyRemoteRoom } from "./handlers/room";
import { setConnectedLabel, updateSessionUI } from "./ui/topbar";
import { showLoginModal, hideLoginModal } from "./ui/loginModal";
import { renderUsers } from "./ui/users";
import { renderChat } from "./ui/chat";
import type { ChatMsg } from "./types";

export function setupSocketListeners(): void {
    // Usamos los callbacks de ciclo de vida de nuestro WSClient
    state.socket.onConnect = () => {
        state.connected = true;
        // Nothing else to do here: the login modal drives the join flow
    };

    state.socket.onDisconnect = () => {
        state.connected = false;
        state.currentUserId = "";
        state.currentRole = "";
        state.users = [];
        renderUsers();
        setConnectedLabel("Disconnected");
        updateSessionUI();
        showLoginModal();
    };

    // Direct reply to our own joinRoom request
    state.socket.on("joinRoomSuccess", (payload: any) => {
        if (payload.user) {
            state.displayName = payload.user.displayName;
            state.currentUserId = payload.user.userId;
            state.currentRole = payload.user.role;
        }

        if (payload.connectedUsers) {
            state.users = payload.connectedUsers;
        }

        if (payload.room) {
            applyRemoteRoom(payload.room);
        }

        setConnectedLabel("MAIN");
        renderUsers();
        updateSessionUI();
        hideLoginModal(); // Hide the loading/login overlay
    });

    // --- Room events (same names as the Socket.IO contract) ---

    state.socket.on(
        "presenceChanged",
        (payload: {
            userId: string;
            displayName?: string | null;
            connected: boolean;
        }) => {
            const { userId, displayName, connected } = payload;
            if (connected) {
                if (!state.users.find((u) => u.userId === userId)) {
                    state.users.push({
                        userId,
                        displayName: displayName ?? userId,
                    });
                    renderUsers();
                }
            } else {
                state.users = state.users.filter((u) => u.userId !== userId);
                renderUsers();
            }
        },
    );

    state.socket.on("roomState", (payload: any) => {
        // Si el payload viene envuelto o directo
        const room = payload?.room || payload;
        if (!room) return;
        applyRemoteRoom(room);
    });

    state.socket.on("chatMsg", (message: ChatMsg) => {
        state.chat = [...state.chat, message];
        renderChat();
    });

    state.socket.on(
        "userRoleUpdated",
        (payload: { userId: string; role: string }) => {
            const user = state.users.find((u) => u.userId === payload.userId);
            if (user) {
                user.role = payload.role;
                renderUsers();
            }
            if (payload.userId === state.currentUserId) {
                state.currentRole = payload.role;
                updateSessionUI();
            }
        },
    );
}
