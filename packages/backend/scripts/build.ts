// packages/backend/scripts/build.ts
import { build } from "esbuild";

const handlers = [
    "connect",
    "disconnect",
    "joinRoom",
    "chatMsg",
    "mediaUpdate",
    "becomeLeader",
    "playlistAdd",
    "transitionNext",
    "playlistRemove",
    "playlistReorder",
    "playlistPlay",
];

async function runBuild() {
    try {
        await Promise.all(
            handlers.map((handler) =>
                build({
                    entryPoints: [`lambda/handlers/${handler}.ts`],
                    bundle: true, // Esto inyecta @smol-tube/domain directamente en el JS final
                    minify: true,
                    platform: "node",
                    target: "es2020",
                    outdir: "dist",
                    // Excluimos AWS SDK porque el entorno de Lambda en la nube ya lo trae instalado por defecto
                    external: ["@aws-sdk/*"],
                }),
            ),
        );
        console.log(
            "✅ Todas las Lambdas compiladas con éxito en packages/backend/dist/",
        );
    } catch (err) {
        console.error("❌ Error en el build:", err);
        process.exit(1);
    }
}

runBuild();
