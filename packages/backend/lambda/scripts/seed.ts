import { randomUUID } from "crypto";
import { userRepo, roomRepo } from "../state";

async function seed() {
    console.log("Iniciando seed de DynamoDB...");

    const adminUserId = randomUUID();

    // 1. Inyectar usuario administrador
    await userRepo.saveUser({
        userId: adminUserId,
        displayName: "Admin/Moderator",
        role: "admin",
    } as any);
    console.log(`✅ Admin creado exitosamente: ${adminUserId}`);

    // 2. Inyectar la sala inicial y hacer al admin el líder por defecto
    const defaultRoomId = "general-room";
    await roomRepo.saveRoom({
        roomId: defaultRoomId,
        bannedUsers: [],
        playback: {
            leaderUserId: adminUserId,
            videoUrl: "",
            status: "paused",
            timestamp: 0,
        },
    } as any);
    console.log(`✅ Sala inicial configurada: ${defaultRoomId}`);

    console.log("🚀 Seed finalizado con éxito.");
}

seed().catch(console.error);
