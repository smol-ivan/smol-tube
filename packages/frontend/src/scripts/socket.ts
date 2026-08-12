// src/socket.ts
import { state } from "./state"; //[cite: 9]
import { applyRemoteRoom } from "./handlers/room"; //[cite: 9]
import { setConnectedLabel, updateSessionUI } from "./ui/topbar"; //[cite: 9]
import { showLoginModal, hideLoginModal } from "./ui/loginModal"; //[cite: 9]
import { renderUsers } from "./ui/users"; //[cite: 9]
import { renderChat } from "./ui/chat"; //[cite: 9]
import type { ChatMsg } from "./types"; //[cite: 9]

export function setupSocketListeners(): void {
    // Usamos los callbacks de ciclo de vida de nuestro WSClient
    state.socket.onConnect = () => {
        state.connected = true;
        // No hacer nada más el login modal maneja el flujo[cite: 9]
    };

    state.socket.onDisconnect = () => {
        state.connected = false; //[cite: 9]
        state.currentUserId = ""; //[cite: 9]
        state.currentRole = ""; //[cite: 9]
        state.users = []; //[cite: 9]
        renderUsers(); //[cite: 9]
        setConnectedLabel("Disconnected"); //[cite: 9]
        updateSessionUI(); //[cite: 9]
        showLoginModal(); //[cite: 9]
    };

    // NUEVO: Escuchar la respuesta directa de nuestro Join Room
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
        hideLoginModal(); // <-- Aquí quitamos la pantalla de carga
    });

    // --- Los eventos de negocio se mantienen IGUAL gracias al Wrapper ---

    state.socket.on(
        "presenceChanged",
        (payload: {
            userId: string;
            displayName?: string | null;
            connected: boolean;
        }) => {
            //[cite: 9]
            const { userId, displayName, connected } = payload; //[cite: 9]
            if (connected) {
                if (!state.users.find((u) => u.userId === userId)) {
                    //[cite: 9]
                    state.users.push({
                        userId,
                        displayName: displayName ?? userId,
                    }); //[cite: 9]
                    renderUsers(); //[cite: 9]
                }
            } else {
                state.users = state.users.filter((u) => u.userId !== userId); //[cite: 9]
                renderUsers(); //[cite: 9]
            }
        },
    );

    state.socket.on("roomState", (payload: any) => {
        //[cite: 9]
        // Si el payload viene envuelto o directo
        const room = payload?.room || payload;
        if (!room) return;
        applyRemoteRoom(room); //[cite: 9]
    });

    state.socket.on("chatMsg", (message: ChatMsg) => {
        //[cite: 9]
        state.chat = [...state.chat, message]; //[cite: 9]
        renderChat(); //[cite: 9]
    });

    state.socket.on(
        "userRoleUpdated",
        (payload: { userId: string; role: string }) => {
            //[cite: 9]
            const user = state.users.find((u) => u.userId === payload.userId); //[cite: 9]
            if (user) {
                user.role = payload.role; //[cite: 9]
                renderUsers(); //[cite: 9]
            }
            if (payload.userId === state.currentUserId) {
                //[cite: 9]
                state.currentRole = payload.role; //[cite: 9]
                updateSessionUI(); //[cite: 9]
            }
        },
    );
}
