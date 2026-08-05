import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.PUBLIC_SOCKET_URL ?? "http://localhost:3000";
const ROOM_ID = "main";

type ChatItem = { from: string; text: string; system?: boolean };

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
    chat: [] as ChatItem[],
    playback: {
        videoId: null as string | null,
        currentTime: 0,
        paused: true,
        leaderUserId: null as string | null,
    },
};

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
        from.className = item.system
            ? "font-label-md text-label-md text-error"
            : "font-label-md text-label-md text-tertiary";
        from.textContent = `${item.from}:`;
        const text = document.createElement("span");
        text.className = item.system
            ? "text-on-surface break-words text-error"
            : "text-on-surface break-words";
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

function connectGuestLogin(): void {
    const password = prompt("Guest login password (optional):") ?? "";
    state.socket.emit(
        "joinRoom",
        { displayName: state.displayName, password, roomId: ROOM_ID },
        (response: { ok: boolean; error?: string; data?: { userId: string } }) => {
            if (!response.ok) return;
            state.currentUserId = response.data?.userId ?? "";
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

state.socket.on("roomState", (payload: { users: Array<{ userId: string; displayName: string }>; chat: ChatItem[]; playback: typeof state.playback }) => {
    state.users = payload.users;
    state.chat = payload.chat;
    state.playback = payload.playback;
    renderUsers();
    renderChat();
});

state.socket.on("chatMsg", (message: ChatItem) => {
    state.chat = [...state.chat, message];
    renderChat();
});

if (elements.chatSendButton && elements.chatInput) {
    elements.chatSendButton.addEventListener("click", () => {
        const text = elements.chatInput?.value.trim();
        if (!text) return;
        state.socket.emit("chatMsg", { text });
        elements.chatInput.value = "";
    });
}

if (elements.guestLoginButton) {
    elements.guestLoginButton.addEventListener("click", connectGuestLogin);
}

state.socket.connect();
renderUsers();
renderChat();
setConnectedLabel("Disconnected");
