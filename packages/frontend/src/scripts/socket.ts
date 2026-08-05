import { state } from "./state";
import { applyRemoteRoom } from "./handlers/room";
import { setConnectedLabel, updateSessionUI } from "./ui/topbar";
import { showLoginModal } from "./ui/loginModal";
import { renderUsers } from "./ui/users";
import { renderChat } from "./ui/chat";
import { renderPlaylist } from "./ui/playlist";
import type { ChatMsg } from "./types";

export function setupSocketListeners(): void {
    state.socket.on("connect", () => {
        state.connected = true;
        // No hacer nada más — el login modal maneja el flujo
    });

    state.socket.on("disconnect", () => {
        state.connected = false;
        state.currentUserId = "";
        state.currentRole = "";
        state.users = [];
        renderUsers();
        setConnectedLabel("Disconnected");
        updateSessionUI();
        showLoginModal();
    });

    state.socket.on(
        "presenceChanged",
        (payload: { userId: string; displayName?: string | null; connected: boolean }) => {
            const { userId, displayName, connected } = payload;
            if (connected) {
                if (!state.users.find((u) => u.userId === userId)) {
                    state.users.push({ userId, displayName: displayName ?? userId });
                    renderUsers();
                }
            } else {
                state.users = state.users.filter((u) => u.userId !== userId);
                renderUsers();
            }
        },
    );

    state.socket.on("roomState", (payload: { room: any }) => {
        if (!payload?.room) return;
        applyRemoteRoom(payload.room);
    });

    state.socket.on("chatMsg", (message: ChatMsg) => {
        state.chat = [...state.chat, message];
        renderChat();
    });

    state.socket.on("userRoleUpdated", (payload: { userId: string; role: string }) => {
        // Update role in local users list
        const user = state.users.find((u) => u.userId === payload.userId);
        if (user) {
            user.role = payload.role;
            renderUsers();
        }
        // Update our own role if it's us
        if (payload.userId === state.currentUserId) {
            state.currentRole = payload.role;
            updateSessionUI();
        }
        console.debug("userRoleUpdated", payload);
    });
}
