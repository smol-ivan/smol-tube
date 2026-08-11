import { state } from "./state";
import { elements } from "./elements";
import { setupSocketListeners } from "./socket";
import { parseYouTubeId, isLeader } from "./utils";
import { renderUsers } from "./ui/users";
import { renderChat, sendChatMessage } from "./ui/chat";
import { renderPlaylist } from "./ui/playlist";
import { setConnectedLabel, updateSessionUI } from "./ui/topbar";
import { showLoginModal, submitLogin } from "./ui/loginModal";
import { applyRemoteRoom } from "./handlers/room";
import { ensureYouTubeApi } from "./ui/player";

// ──────────────────────────────────────────────────────────────
// Logout
// ──────────────────────────────────────────────────────────────
function doLogout(): void {
    state.socket.disconnect();
    state.currentUserId = "";
    state.currentRole = "";
    state.displayName = "";
    state.users = [];
    state.chat = [];
    state.playlist = [];
    state.playback = {
        videoId: null,
        currentTime: 0,
        paused: true,
        leaderUserId: null,
    };
    state.connected = false;

    renderUsers();
    renderChat();
    renderPlaylist();
    setConnectedLabel("Disconnected");
    updateSessionUI();
    showLoginModal();
}

// ──────────────────────────────────────────────────────────────
// DOM event listeners
// ──────────────────────────────────────────────────────────────
function attachEventListeners(): void {
    // Manipulate css of media player
    let currentChatWidth = 280;
    const STEP = 100;
    const MIN_CHAT_WIDTH = 320;
    const MAX_CHAT_WIDTH = 920;

    elements.playerExpandBtn?.addEventListener("click", () => {
        // Para que el reproductor crezca, el chat debe encogerse
        currentChatWidth = Math.max(MIN_CHAT_WIDTH, currentChatWidth - STEP);
        if (elements.dashboardGrid) {
            elements.dashboardGrid.style.gridTemplateColumns = `${currentChatWidth}px 1fr`;
        }
    });

    elements.playerShrinkBtn?.addEventListener("click", () => {
        // Para que el reproductor se reduzca, el chat debe crecer
        currentChatWidth = Math.min(MAX_CHAT_WIDTH, currentChatWidth + STEP);
        if (elements.dashboardGrid) {
            elements.dashboardGrid.style.gridTemplateColumns = `${currentChatWidth}px 1fr`;
        }
    });

    // Login modal
    elements.loginSubmitBtn?.addEventListener("click", submitLogin);
    elements.loginNameInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitLogin();
    });
    elements.loginPasswordInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitLogin();
    });

    // Chat
    elements.chatSendButton?.addEventListener("click", sendChatMessage);
    elements.chatInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendChatMessage();
    });

    // "Cambiar cuenta"
    elements.guestLoginButton?.addEventListener("click", () => {
        showLoginModal();
    });

    // Logout
    elements.logoutButton?.addEventListener("click", doLogout);

    // becomeLeader
    elements.syncStatus?.addEventListener("click", () => {
        if (!state.currentUserId) return;
        state.socket.emit(
            "becomeLeader",
            (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
                if (!resp.ok) {
                    alert(resp.error ?? "No se pudo tomar el control");
                    return;
                }
                if (resp.data?.room) {
                    applyRemoteRoom(resp.data.room);
                }
            },
        );
    });

    // Queue handlers
    function handleQueueVideo(action: "next" | "last"): void {
        const raw = elements.mediaInput?.value.trim() ?? "";
        const videoId = parseYouTubeId(raw);
        if (!videoId) {
            alert("No se pudo obtener el ID de YouTube del input");
            return;
        }

        const atTop = action === "next";

        state.socket.emit(
            "playlistAdd",
            { videoId, atTop },
            (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
                if (!resp.ok) {
                    alert(resp.error ?? "playlistAdd falló");
                    return;
                }
                if (resp.data?.room) applyRemoteRoom(resp.data.room);
                if (elements.mediaInput) elements.mediaInput.value = "";
            },
        );
    }

    elements.queueNextButton?.addEventListener("click", () =>
        handleQueueVideo("next"),
    );
    elements.queueLastButton?.addEventListener("click", () =>
        handleQueueVideo("last"),
    );

    elements.voteSkipBtn?.addEventListener("click", () => {
        state.socket.emit(
            "skipVote",
            {},
            (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
                if (!resp.ok) {
                    alert(resp.error ?? "skipVote falló");
                    return;
                }
                if (resp.data?.room) applyRemoteRoom(resp.data.room);
            },
        );
    });
}

// ──────────────────────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────────────────────

setupSocketListeners();
attachEventListeners();

// Initial render (empty state)
renderUsers();
renderChat();
renderPlaylist();
setConnectedLabel("Disconnected");
updateSessionUI();

// Show login modal on page load
// showLoginModal();

// Initialize YT player container if present
if (document.getElementById("yt-player")) {
    void ensureYouTubeApi();
}
