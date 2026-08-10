import { state } from "../state";
import { elements } from "../elements";
import { formatDuration } from "../utils";

export function renderPlaylist(): void {
    if (!elements.playlistItems) return;
    elements.playlistItems.innerHTML = "";

    if (state.history.length === 0) {
        if (elements.playlistHistory) elements.playlistHistory.classList.add("hidden");
        if (elements.playlistHistory) elements.playlistHistory.classList.remove("flex");
    } else {
        if (elements.playlistHistory) elements.playlistHistory.classList.remove("hidden");
        if (elements.playlistHistory) elements.playlistHistory.classList.add("flex");
        if (elements.playlistHistoryItems) {
            elements.playlistHistoryItems.innerHTML = "";
            for (const item of state.history) {
                const row = document.createElement("div");
                row.className = "flex items-center gap-2 px-2 py-1 border-b border-outline-variant/50 bg-surface-container/30 opacity-75";

                const thumb = document.createElement("img");
                thumb.src = item.thumbnailUrl ?? `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
                thumb.alt = item.title || item.videoId;
                thumb.className = "rounded shrink-0 object-cover";
                thumb.style.width = "40px";
                thumb.style.height = "28px";

                const info = document.createElement("div");
                info.className = "flex-1 overflow-hidden";
                const title = document.createElement("a");
                title.href = `https://youtube.com/watch?v=${item.videoId}`;
                title.target = "_blank";
                title.className = "font-label-sm text-label-sm text-on-surface-variant truncate hover:underline hover:text-secondary";
                title.textContent = item.title || item.videoId;
                info.appendChild(title);

                row.append(thumb, info);
                elements.playlistHistoryItems.appendChild(row);
            }
        }
    }

    if (state.playlist.length === 0) {
        const empty = document.createElement("div");
        empty.className =
            "flex-1 flex items-center justify-center p-4 text-center font-label-md text-label-md text-on-surface-variant opacity-40 italic";
        empty.textContent = "La playlist está vacía";
        elements.playlistItems.appendChild(empty);
    } else {
        for (const [index, item] of state.playlist.entries()) {
            const isPlaying = state.playback.videoId === item.videoId && index === 0;

            const row = document.createElement("div");
            row.className =
                `flex items-center gap-2 p-2 border-b border-outline-variant cursor-pointer hover:bg-surface-container-highest group ${isPlaying ? "bg-surface-container-highest border-l-4 border-l-primary" : "bg-surface-container-high border-l-4 border-l-secondary"}`;

            // Make it draggable
            row.draggable = true;
            row.addEventListener("dragstart", (e) => {
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", index.toString());
                }
                row.classList.add("opacity-50");
            });
            row.addEventListener("dragend", () => {
                row.classList.remove("opacity-50");
            });
            row.addEventListener("dragover", (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                row.classList.add("bg-surface-container-highest");
            });
            row.addEventListener("dragleave", () => {
                row.classList.remove("bg-surface-container-highest");
            });
            row.addEventListener("drop", (e) => {
                e.preventDefault();
                row.classList.remove("bg-surface-container-highest");
                if (e.dataTransfer) {
                    const fromIndexStr = e.dataTransfer.getData("text/plain");
                    if (fromIndexStr) {
                        const fromIndex = parseInt(fromIndexStr, 10);
                        const toIndex = index;
                        if (fromIndex !== toIndex) {
                            state.socket.emit("playlistReorder", { fromIndex, toIndex });
                        }
                    }
                }
            });

            // Remove the whole row click listener since we'll use action icons for play
            // row.addEventListener("click", (e) => { ... });

            const drag = document.createElement("div");
            drag.className = "text-on-surface-variant/50 group-hover:text-on-surface-variant cursor-grab shrink-0";
            drag.innerHTML = isPlaying ? '<span class="material-symbols-outlined text-[16px] text-primary">play_arrow</span>' : '<span class="material-symbols-outlined text-[16px]">drag_indicator</span>';

            // Miniatura del video
            const thumb = document.createElement("img");
            thumb.src = item.thumbnailUrl ?? `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
            thumb.alt = item.title || item.videoId;
            thumb.className = "rounded shrink-0 object-cover";
            thumb.style.width = "48px";
            thumb.style.height = "34px";

            const info = document.createElement("div");
            info.className = "flex-1 overflow-hidden min-w-0";
            const title = document.createElement("a");
            title.href = `https://youtube.com/watch?v=${item.videoId}`;
            title.target = "_blank";
            title.className = `font-label-md text-label-md truncate block hover:underline ${isPlaying ? "text-primary" : "text-secondary"}`;
            title.textContent = item.title || item.videoId;
            title.title = item.title || item.videoId;
            info.appendChild(title);

            const rightSide = document.createElement("div");
            rightSide.className = "flex items-center gap-2";

            // Action icons for leader/admin
            if (state.playback.leaderUserId === state.currentUserId || state.currentRole === "admin") {
                const actions = document.createElement("div");
                actions.className = "hidden group-hover:flex items-center gap-1 text-on-surface-variant";
                
                if (!isPlaying) {
                    const playBtn = document.createElement("button");
                    playBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] hover:text-primary">play_arrow</span>';
                    playBtn.title = "Play Now";
                    playBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        state.socket.emit("playlistPlay", { itemId: item.itemId });
                    });
                    actions.appendChild(playBtn);
                }

                if (index > 1) { // 0 is playing, 1 is already at top
                    const topBtn = document.createElement("button");
                    topBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] hover:text-secondary">vertical_align_top</span>';
                    topBtn.title = "Move to Top (Queue Next)";
                    topBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        state.socket.emit("playlistReorder", { fromIndex: index, toIndex: 1 });
                    });
                    actions.appendChild(topBtn);
                }

                if (index < state.playlist.length - 1 && index > 0) {
                    const bottomBtn = document.createElement("button");
                    bottomBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] hover:text-secondary">vertical_align_bottom</span>';
                    bottomBtn.title = "Move to Bottom";
                    bottomBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        state.socket.emit("playlistReorder", { fromIndex: index, toIndex: state.playlist.length - 1 });
                    });
                    actions.appendChild(bottomBtn);
                }

                if (index > 0) { // Don't remove currently playing video directly here to avoid confusion
                    const delBtn = document.createElement("button");
                    delBtn.innerHTML = '<span class="material-symbols-outlined text-[16px] hover:text-error">close</span>';
                    delBtn.title = "Remove";
                    delBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        state.socket.emit("playlistRemove", { itemId: item.itemId });
                    });
                    actions.appendChild(delBtn);
                }

                rightSide.appendChild(actions);
            }

            const duration = document.createElement("div");
            duration.className = "font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap group-hover:hidden";
            duration.textContent = formatDuration(item.durationSeconds);
            rightSide.appendChild(duration);

            row.append(drag, thumb, info, rightSide);
            elements.playlistItems.appendChild(row);
        }
    }

    const skipVotesCountEl = document.getElementById("skip-votes-count");
    if (skipVotesCountEl) {
        skipVotesCountEl.textContent = state.skipVotes.length.toString();
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
