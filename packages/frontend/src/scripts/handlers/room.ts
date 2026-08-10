import { state } from "../state";
import { elements } from "../elements";
import { isLeader } from "../utils";
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

        // Update playlist
        state.playlist = room.playlist ?? [];
        renderPlaylist();

        // Update current title
        if (elements.currentTitle) {
            if (remoteVideoId) {
                elements.currentTitle.textContent = `youtube.com/watch?v=${remoteVideoId}`;
            } else {
                elements.currentTitle.textContent = "Sin video";
            }
        }

        // Sync button visual: highlight if we're leader
        if (elements.syncStatus) {
            if (isLeader()) {
                elements.syncStatus.classList.add("bg-secondary/40");
                elements.syncStatus.title =
                    "Eres el leader — controlas la reproducción";
            } else {
                elements.syncStatus.classList.remove("bg-secondary/40");
                elements.syncStatus.title = remoteLeader
                    ? `Leader: ${state.users.find((u) => u.userId === remoteLeader)?.displayName ?? remoteLeader}`
                    : "Sin leader — haz clic para tomar el control";
            }
        }

        createPlayerAndApply(remoteVideoId, remoteTime, remotePaused);
    } finally {
        setTimeout(() => {
            suppressEmit = false;
        }, 200);
    }
}
