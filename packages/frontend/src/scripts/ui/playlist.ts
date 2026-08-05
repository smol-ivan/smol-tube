import { state } from "../state";
import { elements } from "../elements";
import { formatDuration } from "../utils";

export function renderPlaylist(): void {
    if (!elements.playlistItems) return;
    elements.playlistItems.innerHTML = "";

    if (state.playlist.length === 0) {
        const empty = document.createElement("div");
        empty.className =
            "flex-1 flex items-center justify-center p-4 text-center font-label-md text-label-md text-on-surface-variant opacity-40 italic";
        empty.textContent = "La playlist está vacía";
        elements.playlistItems.appendChild(empty);
    } else {
        for (const item of state.playlist) {
            const row = document.createElement("div");
            row.className =
                "flex items-center gap-2 p-2 border-b border-outline-variant bg-surface-container-high border-l-4 border-l-secondary cursor-pointer hover:bg-surface-container-highest group";

            const drag = document.createElement("div");
            drag.className = "text-on-surface-variant/50 group-hover:text-on-surface-variant";
            drag.innerHTML = '<span class="material-symbols-outlined text-[16px]">drag_indicator</span>';

            const info = document.createElement("div");
            info.className = "flex-1 overflow-hidden";
            const title = document.createElement("div");
            title.className = "font-label-md text-label-md text-secondary truncate";
            title.textContent = item.title || item.videoId;
            title.title = item.title || item.videoId;
            info.appendChild(title);

            const duration = document.createElement("div");
            duration.className = "font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap";
            duration.textContent = formatDuration(item.durationSeconds);

            row.append(drag, info, duration);
            elements.playlistItems.appendChild(row);
        }
    }

    // Update footer
    const totalSeconds = state.playlist.reduce((acc, i) => acc + i.durationSeconds, 0);
    if (elements.playlistCount) {
        elements.playlistCount.textContent = `${state.playlist.length} item${state.playlist.length !== 1 ? "s" : ""}`;
    }
    if (elements.playlistDuration) {
        elements.playlistDuration.textContent = formatDuration(totalSeconds);
    }
}
