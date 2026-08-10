import { state } from "../state";
import { isLeader } from "../utils";
import { applyRemoteRoom } from "../handlers/room";
import { isSuppressEmit, setSuppressEmit } from "../handlers/room";

let ytPlayer: any = null;
let ytReady = false;
let lastReportedTime = 0;
let lastPlayerState: number | null = null;
let currentControlsSetting = 0;

// FIX (bug: "el leader no ve el video que él mismo agregó, hasta
// recargar la página"): `new YT.Player(...)` asigna `ytPlayer` de
// forma SÍNCRONA, pero el player no está realmente operativo hasta
// que dispara `onReady` (asíncrono, tarda mientras el iframe de
// YouTube inicializa). Si createPlayerAndApply se llama de nuevo en
// esa ventana (ej. el leader agrega un video mientras el player
// todavía se está inicializando), antes se tomaba la rama "reusar
// player existente" -> applyPlaybackToPlayer, que llama métodos como
// loadVideoById/getVideoData sobre un player que aún no responde de
// forma confiable, fallando en silencio.
//
// Con este flag + variable, si createPlayerAndApply se llama antes de
// que onReady haya disparado, en vez de intentar aplicar de inmediato
// guardamos el pedido más reciente y lo aplicamos DENTRO de onReady
// una vez el player esté realmente listo.
let playerIsReady = false;
let pendingApply: {
    videoId: string | null;
    time: number;
    paused: boolean;
} | null = null;

export function ensureYouTubeApi(): Promise<void> {
    return new Promise((resolve) => {
        if ((window as any).YT && (window as any).YT.Player) {
            resolve();
            return;
        }
        const existing = document.querySelector("script[data-yt-api]");
        if (!existing) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            tag.setAttribute("data-yt-api", "1");
            document.head.appendChild(tag);
        }
        (window as any).onYouTubeIframeAPIReady = () => {
            resolve();
        };
    });
}

export async function createPlayerAndApply(
    remoteVideoId: string | null,
    remoteTime: number,
    remotePaused: boolean,
): Promise<void> {
    const shouldHaveControls = isLeader() ? 1 : 0;
    const needsNewPlayer =
        !ytPlayer || currentControlsSetting !== shouldHaveControls;

    if (needsNewPlayer) {
        await ensureYouTubeApi();
        let container = document.getElementById("yt-player");
        if (!container) return;

        if (ytPlayer && typeof ytPlayer.destroy === "function") {
            try {
                ytPlayer.destroy();
            } catch (e) {
                console.warn("failed to destroy old player", e);
            }
            ytPlayer = null;

            // NUEVO: Recrear el div limpio para evitar la pantalla negra
            const parent = container.parentElement;
            if (parent) {
                parent.innerHTML =
                    '<div id="yt-player" class="absolute inset-0 w-full h-full"></div>';
                container = document.getElementById("yt-player"); // Refrescar la referencia
            }
        }

        currentControlsSetting = shouldHaveControls;
        playerIsReady = false;
        // Guardamos el pedido actual como pendiente -- si llegan más
        // actualizaciones antes de que onReady dispare, se sobrescribe
        // aquí mismo y onReady aplicará siempre la más reciente.
        pendingApply = {
            videoId: remoteVideoId,
            time: remoteTime,
            paused: remotePaused,
        };

        ytPlayer = new (window as any).YT.Player(container, {
            height: "100%",
            width: "100%",
            playerVars: { controls: shouldHaveControls, rel: 0 },
            events: {
                onReady: () => {
                    ytReady = true;
                    playerIsReady = true;

                    // Aplica el estado más reciente conocido, sea el que
                    // teníamos al momento de crear el player o uno más
                    // nuevo que haya llegado mientras se inicializaba.
                    const toApply = pendingApply ?? {
                        videoId: state.playback.videoId,
                        time: state.playback.currentTime,
                        paused: state.playback.paused,
                    };
                    pendingApply = null;

                    if (toApply.videoId) {
                        ytPlayer.cueVideoById(toApply.videoId, toApply.time);
                        if (!toApply.paused) ytPlayer.playVideo();
                    }

                    // Iniciar el ping de sincronización (ver Problema 2)
                    startContinuousSync();
                },
                onStateChange: (ev: any) => {
                    handlePlayerStateChange(ev);
                },
            },
        });
    } else if (playerIsReady) {
        applyPlaybackToPlayer(remoteVideoId, remoteTime, remotePaused);
    } else {
        // El player existe pero onReady todavía no ha disparado --
        // NO llamamos a sus métodos todavía (fallarían en silencio).
        // Actualizamos el pedido pendiente; onReady lo aplicará.
        pendingApply = {
            videoId: remoteVideoId,
            time: remoteTime,
            paused: remotePaused,
        };
    }
}

function handlePlayerStateChange(ev: any): void {
    const YT = (window as any).YT;
    if (!YT) return;
    const stateCode = ev.data;
    const currentTime = ytPlayer?.getCurrentTime?.() ?? 0;

    if (isSuppressEmit()) {
        lastReportedTime = currentTime;
        lastPlayerState = stateCode;
        return;
    }

    if (!isLeader()) {
        lastReportedTime = currentTime;
        lastPlayerState = stateCode;
        return;
    }

    if (
        stateCode === YT.PlayerState.PLAYING ||
        stateCode === YT.PlayerState.PAUSED
    ) {
        emitMediaUpdateFromPlayer();
    }

    lastReportedTime = currentTime;
    lastPlayerState = stateCode;
}

function emitMediaUpdateFromPlayer(): void {
    if (!ytPlayer || !isLeader()) return;
    const videoData = ytPlayer.getVideoData?.() ?? {};
    const videoId = videoData.video_id ?? state.playback.videoId ?? null;
    const currentTime = Math.max(
        0,
        Math.floor(ytPlayer.getCurrentTime?.() ?? 0),
    );
    const playerState = (window as any).YT?.PlayerState ?? {};
    const paused = lastPlayerState !== (playerState?.PLAYING ?? 1);

    if (!videoId) return;

    state.socket.emit(
        "mediaUpdate",
        { videoId, currentTime, paused },
        (resp: { ok: boolean; error?: string; data?: { room?: any } }) => {
            if (!resp.ok) {
                console.error("mediaUpdate failed:", resp.error);
                return;
            }
            if (resp.data?.room) applyRemoteRoom(resp.data.room);
        },
    );
}

export function applyPlaybackToPlayer(
    videoId: string | null,
    time: number,
    paused: boolean,
): void {
    if (!ytPlayer) return;
    try {
        if (!videoId) return;

        const currentVideoId = ytPlayer.getVideoData?.()?.video_id ?? null;
        if (currentVideoId !== videoId) {
            ytPlayer.loadVideoById(videoId, time);
        } else {
            const currentTime = ytPlayer.getCurrentTime?.() ?? 0;
            if (Math.abs(currentTime - time) > 1) ytPlayer.seekTo(time, true);
            if (paused) {
                ytPlayer.pauseVideo();
            } else {
                ytPlayer.playVideo();
            }
        }
    } catch (e) {
        console.error("applyPlaybackToPlayer error", e);
    }
}

let syncInterval: number | null = null;

export function startContinuousSync(): void {
    // Evitar múltiples intervalos si se destruye y recrea el player
    if (syncInterval) clearInterval(syncInterval);

    syncInterval = window.setInterval(() => {
        const YT = (window as any).YT;
        if (!YT || !ytPlayer || !ytReady) return;

        // Solo emitimos el "ping" si somos el leader y el video se está reproduciendo
        if (
            isLeader() &&
            ytPlayer.getPlayerState?.() === YT.PlayerState.PLAYING
        ) {
            emitMediaUpdateFromPlayer();
        }
    }, 5000); // Emite el estado cada 5 segundos
}
