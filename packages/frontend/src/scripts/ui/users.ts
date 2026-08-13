import { state } from "../state";
import { elements } from "../elements";
import { roleLabel } from "../utils";

export function renderUsers(): void {
    if (!elements.usersList || !elements.usersCount) return;

    const count = state.users.length;
    elements.usersCount.innerHTML = `Users (${count})`;
    elements.usersList.innerHTML = "";

    for (const user of state.users) {
        const row = document.createElement("div");
        row.className =
            "flex items-center gap-2 text-sm font-label-md text-label-md text-on-surface";

        const dot = document.createElement("span");
        dot.className = "w-2 h-2 bg-secondary rounded-full shrink-0";

        const label = document.createElement("span");
        const badge = roleLabel(user.role ?? "");
        const isMe = user.userId === state.currentUserId;
        label.textContent = `${badge}${badge ? " " : ""}${user.displayName}${isMe ? " (tú)" : ""}`;
        if (isMe) label.className = "text-secondary font-bold";

        row.append(dot, label);
        elements.usersList.appendChild(row);
    }
}
