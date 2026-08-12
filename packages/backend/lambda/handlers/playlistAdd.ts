import { withContext } from "../utils/withContext";
import { broadcastToRoom } from "../utils/broadcast";
import { roomRepo } from "../state";
import { applyPlaylistAdd } from "@smol-tube/domain";
import { randomUUID } from "crypto";

// Rescatado de tu implementación anterior de Socket.IO
function parseIsoDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const h = parseInt(match[1] ?? "0", 10);
    const m = parseInt(match[2] ?? "0", 10);
    const s = parseInt(match[3] ?? "0", 10);
    return h * 3600 + m * 60 + s;
}

async function fetchVideoMeta(videoId: string) {
    const fallback = {
        title: videoId,
        durationSeconds: 0,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return fallback;

    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return fallback;

        const data = (await res.json()) as any;
        const item = data.items?.[0];
        if (!item) return fallback;

        return {
            title: item.snippet?.title ?? videoId,
            durationSeconds: parseIsoDuration(
                item.contentDetails?.duration ?? "",
            ),
            thumbnailUrl:
                item.snippet?.thumbnails?.medium?.url ?? fallback.thumbnailUrl,
        };
    } catch (err) {
        return fallback;
    }
}

export const handler = withContext(async ({ room, user, payload }) => {
    const meta = await fetchVideoMeta(payload.videoId);

    const updatedRoom = applyPlaylistAdd(room, {
        requestingUser: user,
        addedVideo: {
            itemId: randomUUID(),
            videoId: payload.videoId,
            title: meta.title,
            thumbnailUrl: meta.thumbnailUrl,
            addedByUserId: user.userId,
            durationSeconds: meta.durationSeconds,
        },
        ...(payload.atTop !== undefined ? { atTop: payload.atTop } : {}),
    });

    if (!updatedRoom) {
        return { statusCode: 403 };
    }

    await roomRepo.saveRoom(updatedRoom);
    await broadcastToRoom(room.roomId, "roomState", { room: updatedRoom });

    return { statusCode: 200 };
});
