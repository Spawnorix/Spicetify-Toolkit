import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MEDIA = /\.(png|jpe?g|webp|gif|mp4|webm)$/i;
const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = process.argv[2] ?? join(here, "..", "..", "..", "VS-Code", "spawn-s-toolkit", "backgrounds");

if (!existsSync(SOURCE)) {
    console.log(`No backgrounds folder at ${SOURCE}, so none were copied`);
    process.exit(0);
}

const config = readFileSync(execFileSync("spicetify", ["-c"], { encoding: "utf8" }).trim(), "utf8");
const spotify = config.match(/^spotify_path\s*=\s*(.+)$/m)?.[1].trim();
const xpui = spotify && join(spotify, "Apps", "xpui");
if (!xpui || !existsSync(xpui)) {
    console.log("Spotify's app folder wasn't found. Run `spicetify apply` first");
    process.exit(1);
}

const target = join(xpui, "spawn-backgrounds");
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const files = readdirSync(SOURCE).filter(name => MEDIA.test(name)).sort((a, b) => a.localeCompare(b));
const index = files.map((name, i) => {
    const file = `${i}${extname(name).toLowerCase()}`;
    copyFileSync(join(SOURCE, name), join(target, file));
    return { file, name };
});
writeFileSync(join(target, "index.json"), JSON.stringify(index));
console.log(`Copied ${files.length} background${files.length === 1 ? "" : "s"} for Spotify to pick up`);
