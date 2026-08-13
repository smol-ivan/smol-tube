import { state } from "../state";
import { elements } from "../elements";
import { isLeader, renderIcon } from "../utils";
import { renderPlaylist } from "../ui/playlist";
import { createPlayerAndApply } from "../ui/player";

let suppressEmit = false;

export function isSuppressEmit(): boolean {
    return suppressEmit;
}

export function setSuppressEmit(value: boolean): void {
    suppressEmit = value;
}

export function applyRemoteRoom(room: any): void {
    // DEBUG TEMPORAL: confirmar que este cliente recibe el roomState.
    console.log("[DEBUG] applyRemoteRoom recibido ->", {
        videoId: room.playback?.videoId,
        currentTime: room.playback?.currentTime,
        paused: room.playback?.paused,
        leaderUserId: room.playback?.leaderUserId,
    });

    suppressEmit = true;
    try {
        const incomingPlayback = room.playback ?? {};
        const remoteVideoId: string | null = incomingPlayback.videoId ?? null;
        const remoteTime: number = incomingPlayback.currentTime ?? 0;
        const remotePaused: boolean = incomingPlayback.paused ?? true;
        const remoteLeader = incomingPlayback.leaderUserId ?? null;

        state.playback.videoId = remoteVideoId;
        state.playback.currentTime = remoteTime;
        state.playback.paused = remotePaused;
        state.playback.leaderUserId = remoteLeader;

        // Update playlist, history, skipVotes
        state.playlist = room.playlist ?? [];
        state.history = room.history ?? [];
        state.skipVotes = room.skipVotes ?? [];
        renderPlaylist();

        // Update current title — busca el título en la playlist si existe
        if (elements.currentTitle) {
            if (remoteVideoId) {
                const activeItem = state.playlist.find(
                    (item) => item.videoId === remoteVideoId,
                );
                elements.currentTitle.textContent =
                    activeItem?.title && activeItem.title !== remoteVideoId
                        ? activeItem.title
                        : `youtube.com/watch?v=${remoteVideoId}`;
            } else {
                elements.currentTitle.textContent = "Without a video";
            }
        }

        // Sync button visual: highlight if we're leader
        if (elements.syncStatus) {
            const userIsLeader = isLeader();

            if (userIsLeader) {
                // --- ESTADO LÍDER ---
                // Icono: Estrella con Check
                elements.syncStatus.innerHTML = renderIcon(
                    "StarCheck",
                    "size-4 text-secondary",
                );
                elements.syncStatus.title = "You are the leader";

                // Estilos del botón activo (Resaltado en color secondary)
                elements.syncStatus.className =
                    "bg-secondary/20 border border-secondary p-1.5 rounded text-secondary hover:bg-secondary/30 transition-colors cursor-pointer";
            } else {
                // --- ESTADO NO LÍDER ---
                // Icono: Estrella Apagada (StarOff)
                elements.syncStatus.innerHTML = renderIcon(
                    "StarOff",
                    "size-4 text-on-surface-variant",
                );

                const leaderUser = state.users.find(
                    (u) => u.userId === remoteLeader,
                );
                elements.syncStatus.title = remoteLeader
                    ? `Leader: ${leaderUser?.displayName ?? remoteLeader}`
                    : "Without a leader - click on the button to take control";

                // Estilos del botón neutro con hover suave
                elements.syncStatus.className =
                    "bg-surface-variant border border-outline-variant p-1.5 rounded text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors cursor-pointer";
            }
        }
        createPlayerAndApply(remoteVideoId, remoteTime, remotePaused);
    } finally {
        setTimeout(() => {
            suppressEmit = false;
        }, 200);
    }
}
