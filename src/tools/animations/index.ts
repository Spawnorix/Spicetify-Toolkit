import { defineSettings } from "../../settings";
import { addStyle, defineTool } from "../../tool";
import style from "./animations.css";

const SPRING = "linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, "
    + "0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001 85.9%, 1)";
const BAR = 3;

export const settings = defineSettings({
    animationSpeed: {
        type: "slider",
        title: "Speed",
        description: "How long animations take, in milliseconds",
        min: 50,
        max: 1000,
        step: 10,
        default: 220,
        unit: "ms",
        onChange: applyVars
    },
    polishInterface: {
        type: "boolean",
        title: "Polish interface",
        description: "Frosted-glass menus with rounder corners and deeper shadows, glowing focus rings and an accent-coloured cursor",
        default: true,
        onChange: applyVars
    }
});

let varsStyle: HTMLStyleElement | null = null;
let styleElement: HTMLStyleElement | null = null;
let running = false;
const speed = () => settings.store.animationSpeed || 220;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function applyVars() {
    if (!varsStyle) return;
    const ms = speed();
    varsStyle.textContent = `:root {
        --spawn-speed: ${ms}ms;
        --spawn-quick: ${Math.round(ms * 0.6)}ms;
        --spawn-slow: ${Math.round(ms * 1.6)}ms;
        --spawn-spring: ${SPRING};
    }`;
    document.documentElement.toggleAttribute("data-spawn-polish", settings.store.polishInterface);
}


const slider = document.createElement("div");
slider.className = "spawn-slider";
slider.setAttribute("aria-hidden", "true");
const pill = document.createElement("div");
pill.className = "spawn-pill";
pill.setAttribute("aria-hidden", "true");

let sliderAt = "";
let sliderAnim: Animation | undefined;

const LIBRARY = "#Desktop_LeftSidebar_Id";
const LIBRARY_ROWS = `${LIBRARY} [role="row"]`;
const ROWS = `${LIBRARY_ROWS}, #main-view [role="row"]:has([role="gridcell"])`;

const path = () => String(Spicetify.Platform?.History?.location?.pathname ?? "");

function openLibraryRow() {
    const selected = document.querySelector<HTMLElement>(`${LIBRARY_ROWS}[aria-selected="true"]`);
    if (selected) return selected;

    const uri = `spotify${path().replace(/\//g, ":")}`;
    if (uri.split(":").length < 3) return null;
    const label = document.querySelector(`${LIBRARY_ROWS} [aria-labelledby~="listrow-title-${CSS.escape(uri)}"]`);
    return label?.closest<HTMLElement>('[role="row"]') ?? null;
}

function visibleBox(item: HTMLElement) {
    for (let el = item.parentElement; el; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden") return el.getBoundingClientRect();
    }
    return null;
}

const frame = (x: number, y: number, w: number, h: number) => ({ transform: `translate(${x}px, ${y}px)`, width: `${w}px`, height: `${h}px` });

function moveBar(x: number, y: number, w: number, h: number, instant: boolean) {
    const where = `${x},${y},${w},${h}`;
    if (sliderAt === where && slider.classList.contains("spawn-shown")) return;

    const shown = slider.classList.contains("spawn-shown") && sliderAt;
    const from = shown && !instant && !reduced() ? slider.getBoundingClientRect() : undefined;
    sliderAnim?.cancel();
    sliderAt = where;
    Object.assign(slider.style, frame(x, y, w, h));
    slider.classList.add("spawn-shown");

    if (!from) return;
    const top = Math.min(from.top, y);
    const bottom = Math.max(from.bottom, y + h);
    sliderAnim = slider.animate([
        frame(from.left, from.top, from.width, from.height),
        { ...frame(x, top, w, bottom - top), offset: 0.42 },
        frame(x, y, w, h)
    ], { duration: speed() * 1.5, easing: "cubic-bezier(0.45, 0, 0.2, 1)" });
}

function placeBar(instant: boolean) {
    const item = openLibraryRow();
    const box = item && visibleBox(item);
    const rect = item?.getBoundingClientRect();
    if (!item || !box || !rect || rect.height === 0 || rect.bottom <= box.top + 4 || rect.top >= box.bottom - 4) {
        slider.classList.remove("spawn-shown");
        return;
    }
    const top = Math.max(rect.top, box.top);
    const bottom = Math.min(rect.bottom, box.bottom);
    moveBar(rect.left + 1, top + 10, BAR, Math.max(0, bottom - top - 20), instant);
}

function placePill(item: Element) {
    const r = item.getBoundingClientRect();
    if (r.height > 90) return pill.classList.remove("spawn-shown");

    const fresh = !pill.classList.contains("spawn-shown");
    if (fresh) pill.classList.add("spawn-instant");
    pill.style.width = `${r.width}px`;
    pill.style.height = `${r.height}px`;
    pill.style.transform = `translate(${r.left}px, ${r.top}px)`;
    pill.style.borderRadius = getComputedStyle(item).borderRadius;
    pill.classList.add("spawn-shown");
    if (fresh) {
        void pill.offsetWidth;
        pill.classList.remove("spawn-instant");
    }
}

function onMouseOver(e: MouseEvent) {
    const item = (e.target as Element | null)?.closest?.(ROWS);
    if (item) placePill(item.querySelector(':scope > [role="presentation"]') ?? item);
    else pill.classList.remove("spawn-shown");
}


function enterPage() {
    if (reduced()) return;

    setTimeout(() => {
        document.querySelector("#main-view main")?.animate(
            [{ opacity: 0, translate: "0 10px" }, { opacity: 1, translate: "0 0" }],
            { duration: speed() * 1.4, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" }
        );
    }, 30);
}

function onSongChange() {
    if (reduced()) return;

    setTimeout(() => {
        const parts = document.querySelectorAll('[data-testid="now-playing-widget"] > *');
        parts.forEach((part, i) => part.animate(
            [{ opacity: 0, translate: "0 8px" }, { opacity: 1, translate: "0 0" }],
            { duration: speed() * 1.4, delay: i * 40, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)", fill: "backwards" }
        ));
    }, 60);
}


const RIPPLE_TARGETS = [
    "button", '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="menuitemcheckbox"]', '[role="menuitemradio"]',
    '[role="option"]', '[role="row"]', "a[draggable]", ".stk-nav-item", ".stk-nav-sub-item", ".stk-bg-card", ".stk-theme-card"
].join(",");

function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || reduced() || !(e.target instanceof Element)) return;
    const target = e.target.closest<HTMLElement>(RIPPLE_TARGETS);
    if (!target || target.closest('[role="textbox"], input, textarea, [role="slider"], [data-testid*="progress-bar"]')) return;

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.width * rect.height > 900 * 90) return;

    const css = getComputedStyle(target);
    const clip = document.createElement("div");
    clip.className = "spawn-ripple-clip";
    Object.assign(clip.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: css.borderRadius,
        color: css.color
    });
    const size = Math.hypot(rect.width, rect.height) * 2;
    const ripple = document.createElement("div");
    ripple.className = "spawn-ripple";
    Object.assign(ripple.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${e.clientX - rect.left - size / 2}px`,
        top: `${e.clientY - rect.top - size / 2}px`
    });
    clip.append(ripple);
    document.body.append(clip);
    ripple.animate(
        [{ transform: "scale(0)", opacity: 0.28 }, { transform: "scale(1)", opacity: 0 }],
        { duration: speed() * 2.6, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }
    ).finished.finally(() => clip.remove());
}


let queued = false;
let queuedInstant = false;
let ticker: ReturnType<typeof setInterval> | undefined;
let lastPath = "";

function update() {
    const instant = queuedInstant;
    queued = false;
    queuedInstant = false;
    if (!running) return;
    placeBar(instant);
}

function schedule(instant = false) {
    queuedInstant ||= instant;
    if (!queued) {
        queued = true;
        requestAnimationFrame(update);
    }
}

function onScroll(e: Event) {
    pill.classList.remove("spawn-shown");
    const list = e.target;
    if (list instanceof Element && slider.classList.contains("spawn-shown") && list.closest(LIBRARY)) schedule(true);
}

const onResize = () => schedule(true);

let ticks = 0;
function checkPath() {
    const now = path();
    if (now !== lastPath) {
        const first = !lastPath;
        lastPath = now;
        schedule();
        if (!first) enterPage();
        setTimeout(() => schedule(true), 150);
    } else if (++ticks % 14 === 0) {
        schedule(true);
    }
}

export default defineTool({
    name: "Animations",
    title: "Animations",
    description: "A sliding bar on the open playlist, a highlight that follows your mouse, click ripples and springy menus, from Spawn's Toolkit for VS Code",
    icon: "sparkle",
    settings,

    start() {
        running = true;
        varsStyle = addStyle("spawn-animations-vars");
        applyVars();
        styleElement = addStyle("spawn-animations", style);

        (document.getElementById("main") ?? document.body).append(pill, slider);
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("mouseover", onMouseOver, { passive: true });
        document.addEventListener("scroll", onScroll, { capture: true, passive: true });
        window.addEventListener("resize", onResize);
        (Spicetify as any).Player?.addEventListener?.("songchange", onSongChange);

        ticker = setInterval(checkPath, 150);
        lastPath = "";
        checkPath();
    },

    stop() {
        running = false;
        clearInterval(ticker);
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("mouseover", onMouseOver);
        document.removeEventListener("scroll", onScroll, { capture: true });
        window.removeEventListener("resize", onResize);
        (Spicetify as any).Player?.removeEventListener?.("songchange", onSongChange);

        sliderAnim?.cancel();
        sliderAt = "";
        for (const el of [pill, slider]) {
            el.classList.remove("spawn-shown");
            el.remove();
        }

        styleElement?.remove();
        styleElement = null;
        document.documentElement.removeAttribute("data-spawn-polish");
        varsStyle?.remove();
        varsStyle = null;
    }
});
