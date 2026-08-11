import { state } from "../state";
import { elements } from "../elements";
import { roleLabel } from "../utils";

export function setConnectedLabel(text: string): void {
    if (elements.connectedLabel) {
        elements.connectedLabel.innerHTML = `<span class="w-2 h-2 rounded-full ${state.connected ? "bg-secondary" : "bg-error"}"></span> ${text}`;
    }
}

export function updateSessionUI(): void {
    const isLoggedIn = !!state.currentUserId;

    // TopBar: current user display
    if (elements.currentUserDisplay) {
        if (isLoggedIn) {
            const badge = roleLabel(state.currentRole);
            elements.currentUserDisplay.textContent = `${badge}${badge ? " " : ""}${state.displayName}`;
            elements.currentUserDisplay.classList.remove("hidden");
        } else {
            elements.currentUserDisplay.classList.add("hidden");
        }
    }

    // TopBar: logout button
    if (elements.logoutButton) {
        if (isLoggedIn) {
            elements.logoutButton.classList.remove("hidden");
        } else {
            elements.logoutButton.classList.add("hidden");
        }
    }

    // "Cambiar cuenta" button in chat — texto contextual
    if (elements.guestLoginButton) {
        elements.guestLoginButton.textContent = isLoggedIn
            ? "Cambiar cuenta"
            : "Iniciar sesión";
    }
}
