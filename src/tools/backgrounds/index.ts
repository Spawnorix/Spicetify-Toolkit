import { defineSettings } from "../../settings";
import { addStyle, defineTool, Logger } from "../../tool";
import style from "./backgrounds.css";
import * as Files from "./files";

const logger = new Logger("Backgrounds");

const VIDEO = /\.(mp4|webm)$/i;

export const settings = defineSettings({
    backgroundImage: {
        type: "string",
        description: "File name of the background to always show, e.g. Rainy Subway.mp4. Empty picks from all your backgrounds",
        default: "Rainy Subway.mp4",
        hidden: true,
        onChange: () => sync()
    },
    backgroundOpacity: {
        type: "slider",
        title: "Opacity",
        description: "How strongly the background shows. With Screen blending, 20 to 40 still keeps text easy to read",
        min: 1,
        max: 100,
        default: 55,
        unit: "%",
        onChange: () => sync()
    },
    backgroundBlur: {
        type: "slider",
        title: "Blur",
        description: "Softens the background. 0 keeps it sharp",
        min: 0,
        max: 40,
        default: 1,
        unit: "px",
        onChange: () => sync()
    },
    backgroundBlend: {
        type: "select",
        title: "Blend",
        description: "Screen shows it behind Spotify, which only adds light so text never darkens, and stays smooth. Normal lays it over everything, menus included, and is heavier",
        options: [
            { label: "Screen (behind Spotify, smooth)", value: "screen" },
            { label: "Normal (over everything)", value: "normal" }
        ],
        default: "screen",
        onChange: () => sync()
    },
    backgroundCardDarkness: {
        type: "slider",
        title: "Panel darkness",
        description: "How dark your library, the page and the player are over the background, so they're easy to read",
        min: 0,
        max: 100,
        default: 45,
        unit: "%",
        onChange: () => shownKey && placeFrame(settings.store.backgroundBlend)
    },
    backgroundCycleMinutes: {
        type: "number",
        title: "Cycle minutes",
        description: "With Shuffle picked, switch to the next background every this many minutes. 0 keeps one",
        default: 0,
        min: 0,
        onChange: () => sync()
    }
});


let images: string[] = [];
let current: string | undefined;
const listeners = new Set<() => void>();
const urls = new Map<string, Promise<string | null>>();

const notify = () => listeners.forEach(listener => listener());

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

export const getBackgrounds = () => ({ images, current });

export async function refreshBackgrounds() {
    images = await Files.listBackgrounds().catch(e => {
        logger.error("Couldn't list your backgrounds", e);
        return [];
    });
    for (const name of urls.keys()) {
        if (!images.includes(name)) forgetUrl(name);
    }
    notify();
    return images;
}

export function mediaUrl(name: string) {
    let url = urls.get(name);
    if (!url) {
        url = Files.readBackground(name).then(blob => {
            if (!blob) {
                logger.warn(`Couldn't read ${name}`);
                return null;
            }
            return URL.createObjectURL(blob);
        }).catch(e => {
            logger.error(`Couldn't load ${name}`, e);
            return null;
        });
        urls.set(name, url);
    }
    return url;
}

function forgetUrl(name: string) {
    urls.get(name)?.then(url => url && URL.revokeObjectURL(url));
    urls.delete(name);
}

export const isVideo = (name: string) => VIDEO.test(name);

export async function addBackgrounds() {
    const before = images.length;
    const added = await Files.addBackgrounds().catch(e => {
        logger.error("Couldn't add those backgrounds", e);
        return 0;
    });
    if (added) {
        await refreshBackgrounds();
        if (!before && !images.includes(settings.store.backgroundImage)) settings.store.backgroundImage = "";
        await sync();
    }
    return added;
}

export async function removeBackground(name: string) {
    await Files.removeBackground(name);
    forgetUrl(name);
    if (settings.store.backgroundImage === name) settings.store.backgroundImage = "";
    await sync();
}

export const nextBackground = () => sync("next");


interface Layer extends HTMLDivElement {
    spawnVideo?: HTMLVideoElement;
}

let frame: HTMLDivElement | null = null;
let layers: Layer[] = [];
let front = 0;
let shownKey = "";
let cycleTimer: ReturnType<typeof setInterval> | undefined;

function dropVideo(layer: Layer | undefined) {
    const video = layer?.spawnVideo;
    if (!video) return;

    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    layer!.spawnVideo = undefined;
}

function runVideo(layer: Layer, play: boolean) {
    const video = layer.spawnVideo;
    if (!video) return;

    if (play) video.play().catch(() => { });
    else video.pause();
}

const idle = () => document.hidden;
const updateIdle = () => layers.forEach(layer => runVideo(layer, !idle()));

function placeFrame(blend: string | undefined) {
    document.documentElement.dataset.spawnBg = blend === "normal" ? "over" : "behind";
    document.documentElement.style.setProperty("--spawn-card-darkness", `${settings.store.backgroundCardDarkness ?? 45}%`);
}

async function show(name: string | undefined) {
    if (!frame) return;

    const { backgroundOpacity, backgroundBlur, backgroundBlend } = settings.store;
    const key = name ? JSON.stringify([name, backgroundOpacity, backgroundBlur, backgroundBlend]) : "";
    if (key === shownKey) return;
    shownKey = key;

    if (!name) {
        layers.forEach(layer => layer.style.opacity = "0");
        delete document.documentElement.dataset.spawnBg;
        setTimeout(() => {
            if (!shownKey) layers.forEach(dropVideo);
        }, 1500);
        return;
    }

    const url = await mediaUrl(name);
    if (!url || key !== shownKey || !frame) return;

    const next = layers[1 - front];
    dropVideo(next);

    let backgroundImage = "none";
    if (isVideo(name)) {
        const video = Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, src: url });
        next.append(video);
        next.spawnVideo = video;
        await new Promise(resolve => {
            video.addEventListener("canplay", resolve, { once: true });
            video.addEventListener("error", () => {
                logger.error(`Couldn't play ${name}: ${video.error?.message || `media error ${video.error?.code}`}`);
                resolve(null);
            }, { once: true });
            setTimeout(resolve, 3000);
        });
        runVideo(next, !idle());
    } else {
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => { });
        backgroundImage = `url("${url}")`;
    }

    const blur = Math.max(0, Number(backgroundBlur) || 0);
    const old = layers[front];
    setTimeout(() => {
        if (old.style.opacity === "0") dropVideo(old);
    }, 1500);

    const scale = blur > 0 ? 0.25 : 1;
    const spill = blur * 2;
    const filterBlur = blur >= 4 ? blur * scale : 0;
    Object.assign(next.style, {
        backgroundImage,
        filter: filterBlur ? `blur(${filterBlur}px)` : "",
        inset: scale === 1 ? `${-spill}px` : "auto",
        left: scale === 1 ? "" : `${-spill}px`,
        top: scale === 1 ? "" : `${-spill}px`,
        width: scale === 1 ? "" : `calc((100vw + ${spill * 2}px) * ${scale})`,
        height: scale === 1 ? "" : `calc((100vh + ${spill * 2}px) * ${scale})`,
        transformOrigin: "0 0",
        transform: scale === 1 ? "" : `scale(${1 / scale})`,
        opacity: String(Math.min(1, Math.max(0.01, (Number(backgroundOpacity) || 25) / 100)))
    });
    placeFrame(backgroundBlend);
    logger.info(`Showing ${name}`);
    layers[front].style.opacity = "0";
    front = 1 - front;
}

async function sync(pick: "keep" | "next" = "keep") {
    await refreshBackgrounds();
    if (!frame) return;

    const { backgroundImage, backgroundCycleMinutes } = settings.store;
    let chosen: string | undefined;
    if (images.length) {
        const base = (name: string) => name.replace(/\.[^.]+$/, "").toLowerCase();
        const pinned = backgroundImage
            && (images.includes(backgroundImage) ? backgroundImage : images.find(name => base(name) === base(backgroundImage)));

        if (pinned) chosen = pinned;
        else if (pick === "next" && current) chosen = images[(images.indexOf(current) + 1) % images.length];
        else if (current && images.includes(current)) chosen = current;
        else chosen = images[Math.floor(Math.random() * images.length)];
    }

    current = chosen;
    notify();
    await show(chosen);

    clearInterval(cycleTimer);
    cycleTimer = undefined;
    if (chosen && !backgroundImage && backgroundCycleMinutes > 0 && images.length > 1) {
        cycleTimer = setInterval(() => sync("next"), backgroundCycleMinutes * 60_000);
    }
}

let styleElement: HTMLStyleElement | null = null;

export default defineTool({
    name: "Backgrounds",
    title: "Backgrounds",
    description: "Your images and videos from Spawn's Toolkit for VS Code, shown faintly behind Spotify",
    icon: "image",
    settings,

    start() {
        styleElement = addStyle("spawn-backgrounds", style);

        frame = document.createElement("div");
        frame.className = "spawn-background-frame";
        frame.setAttribute("aria-hidden", "true");
        layers = [0, 1].map(() => {
            const layer = document.createElement("div");
            layer.className = "spawn-background";
            frame!.append(layer);
            return layer;
        });
        document.body.prepend(frame);

        document.addEventListener("visibilitychange", updateIdle);

        sync();
        Files.importBundled(settings.store.backgroundImage, () => sync())
            .catch(e => logger.error("Couldn't copy in the VS Code toolkit's backgrounds", e));
    },

    stop() {
        clearInterval(cycleTimer);
        cycleTimer = undefined;
        document.removeEventListener("visibilitychange", updateIdle);

        layers.forEach(dropVideo);
        frame?.remove();
        frame = null;
        layers = [];
        shownKey = "";
        current = undefined;
        delete document.documentElement.dataset.spawnBg;
        document.documentElement.style.removeProperty("--spawn-card-darkness");
        styleElement?.remove();
        styleElement = null;
        notify();
    }
});
