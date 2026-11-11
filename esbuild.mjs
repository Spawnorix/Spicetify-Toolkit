import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const OUT = "dist/spawnsToolkit.js";

function extensionsFolder() {
    try {
        return join(execFileSync("spicetify", ["path", "userdata"], { encoding: "utf8" }).trim(), "Extensions");
    } catch {
        return null;
    }
}

const install = {
    name: "install",
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length) return;
            const folder = extensionsFolder();
            if (!folder) return console.log("Built. Spicetify wasn't found, so it wasn't copied anywhere");
            mkdirSync(folder, { recursive: true });
            copyFileSync(OUT, join(folder, "spawnsToolkit.js"));
            console.log(`Built and copied to ${folder}`);
        });
    }
};

const options = {
    entryPoints: ["src/index.tsx"],
    outfile: OUT,
    bundle: true,
    format: "iife",
    target: "chrome120",
    minify: !watch,
    jsxFactory: "h",
    jsxFragment: "Fragment",
    loader: { ".css": "text" },
    logLevel: "info",
    plugins: [install]
};

if (watch) {
    const context = await esbuild.context(options);
    await context.watch();
} else {
    await esbuild.build(options);
}
