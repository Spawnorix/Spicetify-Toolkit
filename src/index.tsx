import { defineSettings, SettingDef } from "./settings";
import { addStyle, Logger, Tool } from "./tool";
import { tools } from "./tools";
import { startErrorLog } from "./ui/errorLog";
import { openToolkitPanel, ToolkitContext } from "./ui/ToolkitPanel";
import windowStyle from "./ui/toolkit.css";

const logger = new Logger("Toolkit");

const broken = new Map<Tool, string>();
const healthListeners = new Set<() => void>();

const isToolOn = (tool: Tool) => !!(settings.store as Record<string, unknown>)[tool.name];

async function startTool(tool: Tool) {
    if (tool.started || !isToolOn(tool)) return;

    try {
        tool.started = true;
        await tool.start();
    } catch (e) {
        tool.started = false;
        broken.set(tool, "It crashed while starting");
        logger.error(`${tool.name} crashed while starting`, e);
        healthListeners.forEach(listener => listener());
    }
}

function stopTool(tool: Tool) {
    if (!tool.started) return;

    tool.started = false;
    try {
        tool.stop();
    } catch (e) {
        logger.error(`${tool.name} crashed while stopping`, e);
    }
}

const settings = defineSettings(Object.fromEntries(tools.map(tool => [tool.name, {
    type: "boolean",
    title: tool.title,
    description: tool.description,
    default: true,
    hidden: true,
    onChange(enabled: boolean) {
        if (enabled) startTool(tool);
        else stopTool(tool);
    }
} satisfies SettingDef])));

const context: ToolkitContext = {
    tools,
    isToolOn,
    setToolOn(tool, enabled) {
        (settings.store as Record<string, unknown>)[tool.name] = enabled;
    },
    brokenReason: tool => broken.get(tool),
    onHealthChange(listener) {
        healthListeners.add(listener);
        return () => void healthListeners.delete(listener);
    }
};


const svg = (shapes: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes}</svg>`;
const WRENCH = svg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>');
const CART = svg('<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>');

const BACK = svg('<path d="m15 18-6-6 6-6"/>');
const FORWARD = svg('<path d="m9 18 6-6-6-6"/>');

const button = document.createElement("button");
button.className = "spawn-tools-button";
button.title = "Spawn's Toolkit";
button.setAttribute("aria-label", "Spawn's Toolkit");
button.innerHTML = WRENCH;
button.addEventListener("click", () => openToolkitPanel(context));

const wrapper = document.createElement("div");
wrapper.className = "spawn-tools-item";
wrapper.setAttribute("role", "presentation");

function placeButton() {
    const marketplace = document.querySelector<HTMLElement>('#global-nav-bar button[aria-label="Marketplace"]');
    const slot = marketplace?.parentElement;

    if (marketplace && slot?.parentElement) {
        marketplace.classList.add("spawn-tools-button");
        if (!marketplace.querySelector("svg[stroke-linecap]")) marketplace.innerHTML = CART;

        const history = slot.closest(".custom-navlinks-scrollable_container")?.previousElementSibling;
        const arrows = [...history?.querySelectorAll<HTMLElement>(":scope > button") ?? []];
        if (history && arrows.length === 2) {
            history.classList.add("spawn-nav-tiles");
            const gap = history.previousElementSibling;
            if (gap && !gap.children.length) gap.classList.add("spawn-menu-tile");
            arrows.forEach((arrow, i) => {
                if (!arrow.querySelector("svg[stroke-linecap]")) arrow.innerHTML = i ? FORWARD : BACK;
            });
        }

        button.classList.remove("spawn-tools-floating");
        if (button.parentElement !== wrapper) wrapper.append(button);
        if (slot.nextElementSibling !== wrapper) slot.after(wrapper);
    } else if (!button.isConnected) {
        button.classList.add("spawn-tools-floating");
        document.body.append(button);
    }
}


async function main() {
    startErrorLog(["Spawn's Toolkit"]);

    while (!(globalThis as any).Spicetify?.React || !Spicetify.ReactDOM || !Spicetify.Platform) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    addStyle("spawn-toolkit-window", windowStyle);
    await Promise.all(tools.map(startTool));

    placeButton();
    setInterval(placeButton, 2000);
    logger.info(`Started ${tools.filter(tool => tool.started).map(tool => tool.name).join(", ") || "no tools"}`);
}

main().catch(e => logger.error("The toolkit couldn't start", e));
