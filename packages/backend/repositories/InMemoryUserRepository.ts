import { User, UserRepository } from "@smol-tube/domain";

function normalizeDisplayName(displayName: string): string {
    return displayName.trim().toLowerCase();
}

export class InMemoryUserRepository implements UserRepository {
    private usersById = new Map<string, User>();
    private userIdsByDisplayName = new Map<string, string>();

    async getUserById(userId: string): Promise<User | null> {
        return this.usersById.get(userId) ?? null;
    }

    async getUserByDisplayName(displayName: string): Promise<User | null> {
        const normalized = normalizeDisplayName(displayName);
        const userId = this.userIdsByDisplayName.get(normalized);
        if (!userId) {
            return null;
        }
        return this.usersById.get(userId) ?? null;
    }

    async saveUser(user: User): Promise<void> {
        const existing = this.usersById.get(user.userId);
        if (existing) {
            this.userIdsByDisplayName.delete(
                normalizeDisplayName(existing.displayName),
            );
        }

        this.usersById.set(user.userId, user);
        this.userIdsByDisplayName.set(
            normalizeDisplayName(user.displayName),
            user.userId,
        );
    }

    async deleteUser(userId: string): Promise<void> {
        const existing = this.usersById.get(userId);
        if (existing) {
            this.userIdsByDisplayName.delete(
                normalizeDisplayName(existing.displayName),
            );
        }
        this.usersById.delete(userId);
    }
}
