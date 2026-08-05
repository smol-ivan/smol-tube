import { Role, createEmptyRoom } from "@smol-tube/domain";
import { userRepository, roomRepository } from "./state";
import { SeedUserConfig } from "./types";
import { mockPasswordHash } from "./utils";

export const DEFAULT_ROOM_ID = "main";
export const EPOCH_TTL_DISABLED = null;

function isRole(value: unknown): value is Role {
    return value === "guest" || value === "moderator" || value === "admin";
}

export function parseSeedUsersJson(seedUsersJson: string): unknown {
    try {
        return JSON.parse(seedUsersJson);
    } catch (error) {
        throw new Error(
            `SEED_USERS_JSON must be valid JSON: ${
                error instanceof Error ? error.message : "unknown parse error"
            }`,
        );
    }
}

export function validateSeedUsers(parsed: unknown): SeedUserConfig[] {
    if (!Array.isArray(parsed)) {
        throw new Error("SEED_USERS_JSON must be a JSON array");
    }

    const normalizedNames = new Set<string>();
    const validated: SeedUserConfig[] = [];

    parsed.forEach((entry, index) => {
        if (typeof entry !== "object" || entry === null) {
            throw new Error(`SEED_USERS_JSON[${index}] must be an object`);
        }

        const maybeDisplayName = (entry as { displayName?: unknown }).displayName;
        const maybePassword = (entry as { password?: unknown }).password;
        const maybeRole = (entry as { role?: unknown }).role;

        if (typeof maybeDisplayName !== "string" || !maybeDisplayName.trim()) {
            throw new Error(
                `SEED_USERS_JSON[${index}].displayName must be a non-empty string`,
            );
        }
        if (typeof maybePassword !== "string" || !maybePassword.trim()) {
            throw new Error(
                `SEED_USERS_JSON[${index}].password must be a non-empty string`,
            );
        }
        if (!isRole(maybeRole)) {
            throw new Error(
                `SEED_USERS_JSON[${index}].role must be one of: guest, moderator, admin`,
            );
        }

        const normalized = maybeDisplayName.trim().toLowerCase();
        if (normalizedNames.has(normalized)) {
            throw new Error(
                `SEED_USERS_JSON has duplicate displayName: "${maybeDisplayName.trim()}"`,
            );
        }
        normalizedNames.add(normalized);

        validated.push({
            displayName: maybeDisplayName.trim(),
            password: maybePassword.trim(),
            role: maybeRole,
        });
    });

    return validated;
}

function readEnvRequiredIfPair(
    nameKey: string,
    passwordKey: string,
): { displayName: string; password: string } | null {
    const displayName = process.env[nameKey]?.trim();
    const password = process.env[passwordKey]?.trim();
    if (!displayName || !password) {
        return null;
    }
    return { displayName, password };
}

export async function ensureMainRoom(): Promise<import("@smol-tube/domain").Room> {
    const existing = await roomRepository.getRoom(DEFAULT_ROOM_ID);
    if (existing) {
        return existing;
    }

    const created = createEmptyRoom(DEFAULT_ROOM_ID, EPOCH_TTL_DISABLED);
    await roomRepository.saveRoom(created);
    return created;
}

export async function seedMockAccounts(): Promise<void> {
    const seedUsersJson = process.env.SEED_USERS_JSON?.trim();
    if (seedUsersJson) {
        const parsed = parseSeedUsersJson(seedUsersJson);
        const validated = validateSeedUsers(parsed);

        await Promise.all(
            validated.map((seedUser) =>
                userRepository.saveUser({
                    userId: `${seedUser.role}:${seedUser.displayName.toLowerCase()}`,
                    displayName: seedUser.displayName,
                    role: seedUser.role,
                    passwordHash: mockPasswordHash(seedUser.password),
                    expiresAt: EPOCH_TTL_DISABLED,
                }),
            ),
        );
        return;
    }

    const adminPair = readEnvRequiredIfPair(
        "SEED_ADMIN_DISPLAY_NAME",
        "SEED_ADMIN_PASSWORD",
    );
    if (adminPair) {
        await userRepository.saveUser({
            userId: `admin:${adminPair.displayName.toLowerCase()}`,
            displayName: adminPair.displayName,
            role: "admin",
            passwordHash: mockPasswordHash(adminPair.password),
            expiresAt: EPOCH_TTL_DISABLED,
        });
    }

    const moderatorPair = readEnvRequiredIfPair(
        "SEED_MODERATOR_DISPLAY_NAME",
        "SEED_MODERATOR_PASSWORD",
    );
    if (moderatorPair) {
        await userRepository.saveUser({
            userId: `moderator:${moderatorPair.displayName.toLowerCase()}`,
            displayName: moderatorPair.displayName,
            role: "moderator",
            passwordHash: mockPasswordHash(moderatorPair.password),
            expiresAt: EPOCH_TTL_DISABLED,
        });
    }
}
