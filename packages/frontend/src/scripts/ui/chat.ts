import { state } from "../state";
import { elements } from "../elements";

export function renderChat(): void {
    if (!elements.chatMessages) return;
    elements.chatMessages.innerHTML = "";

    const header = document.createElement("div");
    header.className =
        "text-on-surface-variant text-center my-4 font-label-md text-label-md italic opacity-70";
    header.textContent = "--- Chat active ---";
    elements.chatMessages.appendChild(header);

    for (const item of state.chat) {
        const row = document.createElement("div");
        row.className = "flex items-start gap-2";

        const from = document.createElement("span");
        from.className = "font-label-md text-label-md text-tertiary shrink-0";
        from.textContent = `${item.fromDisplayName}:`;

        const text = document.createElement("span");
        text.className = "text-on-surface break-words";
        text.textContent = item.text;

        row.append(from, text);
        elements.chatMessages.appendChild(row);
    }

    // Auto-scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

import { setConnectedLabel } from "./topbar";

export function sendChatMessage(): void {
    const text = elements.chatInput?.value.trim();
    if (!text || !state.currentUserId) {
        if (!state.currentUserId)
            setConnectedLabel("Desconectado — inicia sesión");
        return;
    }
    state.socket.emit(
        "chatMsg",
        { text },
        (resp: { ok: boolean; error?: string }) => {
            if (!resp.ok) {
                console.error("chatMsg failed:", resp.error);
            }
        },
    );
    if (elements.chatInput) elements.chatInput.value = "";
}
