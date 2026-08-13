import { state } from "../state";
import { elements } from "../elements";

export function showLoginModal(): void {
    if (!elements.loginModal) return;
    elements.loginModal.classList.remove("hidden");

    // Reset form
    if (elements.loginNameInput) elements.loginNameInput.value = "";
    if (elements.loginPasswordInput) elements.loginPasswordInput.value = "";
    if (elements.loginErrorMsg) {
        elements.loginErrorMsg.textContent = "";
        elements.loginErrorMsg.classList.add("hidden");
    }
    if (elements.loginSubmitBtn) {
        elements.loginSubmitBtn.disabled = false;
        elements.loginSubmitBtn.textContent = "Unirse a la sala";
    }

    // Pre-fill name if already have one
    if (elements.loginNameInput && state.displayName) {
        elements.loginNameInput.value = state.displayName;
    }

    // Focus name input
    setTimeout(() => elements.loginNameInput?.focus(), 50);
}

export function hideLoginModal(): void {
    if (!elements.loginModal) return;
    elements.loginModal.classList.add("hidden");
}

export function setLoginError(msg: string): void {
    if (!elements.loginErrorMsg) return;
    elements.loginErrorMsg.textContent = msg;
    elements.loginErrorMsg.classList.remove("hidden");
    if (elements.loginSubmitBtn) {
        elements.loginSubmitBtn.disabled = false;
        elements.loginSubmitBtn.textContent = "Join Room";
    }
}

export function doJoinRoom(displayName: string, password?: string): void {
    if (elements.loginSubmitBtn) {
        elements.loginSubmitBtn.disabled = true;
        elements.loginSubmitBtn.textContent = "Conectando...";
    }

    const payload: { displayName: string; roomId: string; password?: string } =
        {
            displayName,
            roomId: "main",
        };
    if (password) payload.password = password;

    // Solo emitimos. Ya no esperamos que response.data venga en el callback.
    // El frontend ahora reaccionará asíncronamente al evento "joinRoomSuccess".
    state.socket.emit("joinRoom", payload);
}

export function submitLogin(): void {
    const displayName = elements.loginNameInput?.value.trim() ?? "";
    const password = elements.loginPasswordInput?.value ?? "";

    if (!displayName) {
        setLoginError("El nombre de usuario es obligatorio");
        return;
    }

    if (elements.loginErrorMsg) elements.loginErrorMsg.classList.add("hidden");

    if (!state.socket.connected) {
        if (elements.loginSubmitBtn) {
            elements.loginSubmitBtn.disabled = true;
            elements.loginSubmitBtn.textContent = "Conectando...";
        }
        state.socket.connect();
        state.socket.once("connect", () => doJoinRoom(displayName, password));
    } else {
        doJoinRoom(displayName, password);
    }
}
