import { state } from "./state";
import { icons, createElement } from "lucide";

export function isLeader(): boolean {
    return !!(
        state.playback.leaderUserId &&
        state.currentUserId === state.playback.leaderUserId
    );
}

export function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function roleLabel(role: string): string {
    if (role === "admin") return "👑";
    if (role === "moderator") return "🛡️";
    return "";
}

export function parseYouTubeId(input: string): string | null {
    if (!input) return null;
    const idCandidate = input.trim();
    try {
        const u = new URL(input);
        if (u.hostname.includes("youtube.com")) {
            const v = u.searchParams.get("v");
            if (v) return v;
            const parts = u.pathname.split("/").filter(Boolean);
            const embedIndex = parts.indexOf("embed");
            if (embedIndex >= 0 && parts.length > embedIndex + 1)
                return parts[embedIndex + 1];
        }
        if (u.hostname === "youtu.be") {
            const parts = u.pathname.split("/").filter(Boolean);
            if (parts.length) return parts[0];
        }
    } catch (_) {
        // not a URL, try as bare ID
    }
    const simpleId = idCandidate.match(/^[a-zA-Z0-9_-]{8,}$/);
    if (simpleId) return idCandidate;
    return null;
}

export function renderIcon(
    iconName: keyof typeof icons,
    customClass: string = "size-4",
): string {
    const iconData = icons[iconName];
    if (!iconData) return "";

    // createElement crea un elemento SVG del DOM
    const svgElement = createElement(iconData);

    // Le aplicamos tus clases de Tailwind
    svgElement.setAttribute("class", customClass);

    // Retornamos el HTML en string
    return svgElement.outerHTML;
}
