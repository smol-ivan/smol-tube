import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL ?? "http://localhost:3000";
const ROOM_ID = "main";

// Incoming chat message shape from server
type ChatMsg = {
    fromUserId: string;
    fromDisplayName: string;
    text: string;
    sentAt: number;
};

const elements = {
    connectedLabel: document.querySelector<HTMLElement>("[data-connected-label]"),
    chatMessages: document.querySelector<HTMLElement>("[data-chat-messages]"),
    chatInput: document.querySelector<HTMLInputElement>("[data-chat-input]"),
    chatSendButton: document.querySelector<HTMLButtonElement>("[data-chat-send]"),
    guestLoginButton: document.querySelector<HTMLButtonElement>("[data-guest-login]"),
    usersCount: document.querySelector<HTMLElement>("[data-users-count]"),
    usersList: document.querySelector<HTMLElement>("[data-users-list]"),
    mediaInput: document.querySelector<HTMLInputElement>("[data-media-input]"),
    queueNextButton: document.querySelector<HTMLButtonElement>("[data-queue-next]"),
    queueLastButton: document.querySelector<HTMLButtonElement>("[data-queue-last]"),
    temporaryCheckbox: document.querySelector<HTMLInputElement>("[data-temporary-checkbox]"),
    currentTitle: document.querySelector<HTMLElement>("[data-current-title]"),
    syncStatus: document.querySelector<HTMLButtonElement>("[data-sync-status]"),
};

const state = {
    socket: io(SOCKET_URL, { autoConnect: false }),
    connected: false,
    displayName: "smol-test",
    currentUserId: "",
    users: [] as Array<{ userId: string; displayName: string }>,
    chat: [] as ChatMsg[],
    // playback mirrors server Room.playback
    playback: {
        videoId: null as string | null,
        currentTime: 0,
        paused: true,
        leaderUserId: null as string | null,
    },
};

// YouTube player state
let ytPlayer: any = null;
let ytReady = false;
let suppressEmit = false; // when applying remote roomState, avoid re-emitting mediaUpdate
let lastReportedTime = 0;
let lastPlayerState: number | null = null;
let currentControlsSetting = 0; // 0 or 1

function setConnectedLabel(text: string): void {
    if (elements.connectedLabel) {
        elements.connectedLabel.textContent = `Connected: ${text}`;
    }
}

function renderChat(): void {
    if (!elements.chatMessages) return;
    elements.chatMessages.innerHTML = "";
    const connected = document.createElement("div");
    connected.className =
        "text-on-surface-variant text-center my-4 font-label-md text-label-md italic opacity-70";
    connected.textContent = "--- Chat connected ---";
    elements.chatMessages.appendChild(connected);
    for (const item of state.chat) {
        const row = document.createElement("div");
        row.className = "flex items-start gap-2";
        const from = document.createElement("span");
        from.className = "font-label-md text-label-md text-tertiary";
        from.textContent = `${item.fromDisplayName}:`;
        const text = document.createElement("span");
        text.className = "text-on-surface break-words";
        text.textContent = item.text;
        row.append(from, text);
        elements.chatMessages.appendChild(row);
    }
}

function renderUsers(): void {
    if (!elements.usersList || !elements.usersCount) return;
    elements.usersCount.textContent = `Users (${state.users.length})`;
    elements.usersList.innerHTML = "";
    for (const user of state.users) {
        const row = document.createElement("div");
        row.className = "flex items-center gap-2 text-sm font-label-md text-label-md text-on-surface";
        row.innerHTML = '<span class="w-2 h-2 bg-secondary rounded-full"></span>';
        const label = document.createElement("span");
        label.textContent = user.displayName;
        row.appendChild(label);
        elements.usersList.appendChild(row);
    }
}

function isLeader(): boolean {
    return !!(state.playback.leaderUserId && state.currentUserId === state.playback.leaderUserId);
}

function connectGuestLogin(): void {
    const password = prompt("Guest login password (optional):") ?? "";
    state.socket.emit(
        "joinRoom",
        { displayName: state.displayName, password, roomId: ROOM_ID },
        (response: { ok: boolean; error?: string; data?: { room?: any; user?: { userId: string } } }) => {
            if (!response.ok) {
                alert(response.error ?? "join failed");
                return;
            }
            // server ack includes room and user
            if (response.data?.user) {
                state.currentUserId = response.data.user.userId;
            }
            if (response.data?.room) {
                // apply playback from room without emitting mediaUpdate
                applyRemoteRoom(response.data.room);
            }
            setConnectedLabel(ROOM_ID.toUpperCase());
        },
    );
}

state.socket.on("connect", () => {
    state.connected = true;
    setConnectedLabel(ROOM_ID.toUpperCase());
    connectGuestLogin();
});

state.socket.on("disconnect", () => {
    state.connected = false;
    setConnectedLabel("Disconnected");
});

// Presence: server emits { userId, displayName, connected }
state.socket.on("presenceChanged", (payload: { userId: string; displayName?: string | null; connected: boolean }) => {
    const { userId, displayName, connected } = payload;
    if (connected) {
        // add if not present
        if (!state.users.find((u) => u.userId === userId)) {
            state.users.push({ userId, displayName: displayName ?? userId });
            renderUsers();
        }
    } else {
        state.users = state.users.filter((u) => u.userId !== userId);
        renderUsers();
    }
});

// roomState: payload { room }
state.socket.on("roomState", (payload: { room: any }) => {
    if (!payload || !payload.room) return;
    applyRemoteRoom(payload.room);
});

state.socket.on("chatMsg", (message: ChatMsg) => {
    state.chat = [...state.chat, message];
    renderChat();
});

state.socket.on("userRoleUpdated", (payload: { userId: string; role: string }) => {
    // no complex state update needed right now; placeholder for UI updates
    console.debug("userRoleUpdated", payload);
});

if (elements.chatSendButton && elements.chatInput) {
    elements.chatSendButton.addEventListener("click", () => {
        const text = elements.chatInput?.value.trim();
        if (!text) return;
        state.socket.emit("chatMsg", { text }, (resp: { ok: boolean; error?: string }) => {
            if (!resp.ok) {
                alert(resp.error ?? "send failed");
            }
        });
        elements.chatInput.value = "";
    });
}

if (elements.guestLoginButton) {
    elements.guestLoginButton.addEventListener("click", connectGuestLogin);
}

// becomeLeader control
if (elements.syncStatus) {
    elements.syncStatus.addEventListener("click", () => {
        state.socket.emit("becomeLeader", (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
            if (!resp.ok) {
                alert(resp.error ?? "cannot become leader");
                return;
            }
            if (resp.data?.room) {
                applyRemoteRoom(resp.data.room);
            }
        });
    });
}

// Media input -> setActiveVideo when leader
if (elements.queueNextButton && elements.mediaInput) {
    elements.queueNextButton.addEventListener("click", () => {
        const raw = elements.mediaInput?.value.trim() ?? "";
        const videoId = parseYouTubeId(raw);
        if (!videoId) {
            alert("Could not parse YouTube video ID from input");
            return;
        }
        if (!isLeader()) {
            alert("Only leader can set the active video");
            return;
        }
        state.socket.emit("setActiveVideo", { videoId }, (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
            if (!resp.ok) {
                alert(resp.error ?? "setActiveVideo failed");
                return;
            }
            if (resp.data?.room) {
                applyRemoteRoom(resp.data.room);
            }
        });
    });
}

if (elements.queueLastButton && elements.mediaInput) {
    elements.queueLastButton.addEventListener("click", () => {
        // For now treat 'queue last' same as setActiveVideo in this phase
        const raw = elements.mediaInput?.value.trim() ?? "";
        const videoId = parseYouTubeId(raw);
        if (!videoId) {
            alert("Could not parse YouTube video ID from input");
            return;
        }
        if (!isLeader()) {
            alert("Only leader can set the active video");
            return;
        }
        state.socket.emit("setActiveVideo", { videoId }, (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
            if (!resp.ok) {
                alert(resp.error ?? "setActiveVideo failed");
                return;
            }
            if (resp.data?.room) {
                applyRemoteRoom(resp.data.room);
            }
        });
    });
}

state.socket.connect();
renderUsers();
renderChat();
setConnectedLabel("Disconnected");

// ---------------- YouTube Player integration ----------------

function ensureYouTubeApi(): Promise<void> {
    return new Promise((resolve) => {
        if ((window as any).YT && (window as any).YT.Player) {
            resolve();
            return;
        }
        const existing = document.querySelector("script[data-yt-api]");
        if (!existing) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            tag.setAttribute("data-yt-api", "1");
            document.head.appendChild(tag);
        }
        (window as any).onYouTubeIframeAPIReady = () => {
            resolve();
        };
    });
}

async function createPlayer(controls: 0 | 1): Promise<void> {
    await ensureYouTubeApi();
    const container = document.getElementById("yt-player");
    if (!container) return;
    // destroy old player if any
    if (ytPlayer && typeof ytPlayer.destroy === "function") {
        try {
            ytPlayer.destroy();
        } catch (e) {
            console.warn("failed to destroy old player", e);
        }
        ytPlayer = null;
    }

    currentControlsSetting = controls;

    ytPlayer = new (window as any).YT.Player(container, {
        height: '100%',
        width: '100%',
        playerVars: {
            controls: controls,
            rel: 0,
        },
        events: {
            onReady: (e: any) => {
                ytReady = true;
                // apply current playback state if any
                if (state.playback.videoId) {
                    // load but keep paused according to state
                    ytPlayer.cueVideoById(state.playback.videoId, state.playback.currentTime);
                    if (!state.playback.paused) {
                        ytPlayer.playVideo();
                    }
                }
            },
            onStateChange: (ev: any) => {
                handlePlayerStateChange(ev);
            },
        },
    });
}

function handlePlayerStateChange(ev: any) {
    const YT = (window as any).YT;
    if (!YT) return;
    const stateCode = ev.data;
    const currentTime = ytPlayer?.getCurrentTime?.() ?? 0;

    // detect seek: compare difference between current time and lastReportedTime
    const timeDiff = Math.abs(currentTime - lastReportedTime);

    if (suppressEmit) {
        lastReportedTime = currentTime;
        lastPlayerState = stateCode;
        return;
    }

    // Only leader should emit mediaUpdate
    if (!isLeader()) {
        lastReportedTime = currentTime;
        lastPlayerState = stateCode;
        return;
    }

    // PLAYING
    if (stateCode === YT.PlayerState.PLAYING) {
        // if big time jump -> seek
        if (timeDiff > 2 && lastPlayerState !== null) {
            emitMediaUpdateFromPlayer();
        } else {
            emitMediaUpdateFromPlayer();
        }
    }

    // PAUSED
    if (stateCode === YT.PlayerState.PAUSED) {
        emitMediaUpdateFromPlayer();
    }

    lastReportedTime = currentTime;
    lastPlayerState = stateCode;
}

function emitMediaUpdateFromPlayer() {
    if (!ytPlayer || !isLeader()) return;
    const videoData = ytPlayer.getVideoData?.() ?? {};
    const videoId = videoData.video_id ?? state.playback.videoId ?? null;
    const currentTime = Math.max(0, Math.floor((ytPlayer.getCurrentTime?.() ?? 0)));
    const playerState = (window as any).YT?.PlayerState ?? {};
    const paused = lastPlayerState !== (playerState?.PLAYING ?? 1);

    if (!videoId) return;

    // emit mediaUpdate with ack pattern
    state.socket.emit(
        "mediaUpdate",
        { videoId, currentTime, paused },
        (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
            if (!resp.ok) {
                console.error("mediaUpdate failed:", resp.error);
                return;
            }
            if (resp.data?.room) {
                // apply returned room without re-emitting
                applyRemoteRoom(resp.data.room);
            }
        },
    );
}

function applyRemoteRoom(room: any) {
    // prevent emitting mediaUpdate while applying
    suppressEmit = true;
    try {
        const incomingPlayback = room.playback ?? {};
        const remoteVideoId: string | null = incomingPlayback.videoId ?? null;
        const remoteTime: number = incomingPlayback.currentTime ?? 0;
        const remotePaused: boolean = incomingPlayback.paused ?? true;
        const remoteLeader = incomingPlayback.leaderUserId ?? null;

        const prevLeader = state.playback.leaderUserId;
        const prevVideoId = state.playback.videoId;

        // update local state
        state.playback.videoId = remoteVideoId;
        state.playback.currentTime = remoteTime;
        state.playback.paused = remotePaused;
        state.playback.leaderUserId = remoteLeader;

        renderUsers();

        // if controls setting should change (leader status changed for this client), recreate player
        const shouldHaveControls = isLeader() ? 1 : 0;
        if (!ytPlayer || currentControlsSetting !== shouldHaveControls) {
            // recreate player with appropriate controls and then apply playback
            createPlayer(shouldHaveControls as 0 | 1).then(() => {
                applyPlaybackToPlayer(remoteVideoId, remoteTime, remotePaused);
            });
        } else {
            applyPlaybackToPlayer(remoteVideoId, remoteTime, remotePaused);
        }
    } finally {
        // small delay to avoid race where player events fire immediately
        setTimeout(() => {
            suppressEmit = false;
        }, 200);
    }
}

function applyPlaybackToPlayer(videoId: string | null, time: number, paused: boolean) {
    if (!ytPlayer) return;
    try {
        if (!videoId) {
            // nothing to load
            return;
        }

        const currentVideoId = ytPlayer.getVideoData?.()?.video_id ?? null;
        if (currentVideoId !== videoId) {
            // load new video
            ytPlayer.loadVideoById(videoId, time);
        } else {
            // same video - seek and play/pause
            const currentTime = ytPlayer.getCurrentTime?.() ?? 0;
            if (Math.abs(currentTime - time) > 1) {
                ytPlayer.seekTo(time, true);
            }
            if (paused) {
                ytPlayer.pauseVideo();
            } else {
                ytPlayer.playVideo();
            }
        }
    } catch (e) {
        console.error("applyPlaybackToPlayer error", e);
    }
}

function parseYouTubeId(input: string): string | null {
    if (!input) return null;
    // If it's already an id (11 chars common but not enforced), quick check
    const idCandidate = input.trim();
    // url patterns
    try {
        const u = new URL(input);
        if (u.hostname.includes("youtube.com")) {
            const v = u.searchParams.get("v");
            if (v) return v;
            // /embed/VIDEOID
            const parts = u.pathname.split("/").filter(Boolean);
            const embedIndex = parts.indexOf("embed");
            if (embedIndex >= 0 && parts.length > embedIndex + 1) return parts[embedIndex + 1];
        }
        if (u.hostname === "youtu.be") {
            const parts = u.pathname.split("/").filter(Boolean);
            if (parts.length) return parts[0];
        }
    } catch (e) {
        // not a url, maybe it's an id
    }
    // fallback: if matches common id chars
    const simpleId = idCandidate.match(/^[a-zA-Z0-9_-]{8,}$/);
    if (simpleId) return idCandidate;
    return null;
}

// initialize player container if present
if (document.getElementById("yt-player")) {
    // create with controls = 0 by default; will be recreated when becoming leader
    void createPlayer(0);
}
