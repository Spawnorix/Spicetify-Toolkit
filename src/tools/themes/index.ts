import { defineSettings } from "../../settings";
import { addStyle, defineTool } from "../../tool";
import { alpha, mix, Palette, PALETTES, uiColors } from "./palettes";
import extrasStyle from "./themes.css";

const DEFAULT_THEME = "pure-black-violet";

let paletteStyle: HTMLStyleElement | null = null;
let extras: HTMLStyleElement | null = null;

export const settings = defineSettings({
    theme: {
        type: "string",
        description: "The theme to use. Picked from the gallery",
        default: DEFAULT_THEME,
        hidden: true,
        onChange: applyTheme
    },
    roundness: {
        type: "slider",
        title: "Roundness",
        description: "How rounded corners are across Spotify",
        min: 0,
        max: 24,
        default: 12,
        unit: "px",
        onChange: applyTheme
    }
});

export function getPalette(id = settings.store.theme): Palette {
    return PALETTES.find(p => p.id === id) ?? PALETTES.find(p => p.id === DEFAULT_THEME)!;
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",");

function spiceColors(p: Palette): Record<string, string> {
    const ui = uiColors(p);
    const black = p.category === "black";

    return {
        main: p.bg,
        sidebar: p.bgAlt,
        player: p.bgAlt,
        "main-elevated": p.surface,
        card: p.surface,
        highlight: black ? mix("#000000", ui.bright, 0.1) : mix(p.bg, p.fg, 0.07),
        "highlight-elevated": black ? mix("#000000", ui.bright, 0.16) : mix(p.surface, p.fg, 0.1),
        "tab-active": black ? mix("#000000", ui.bright, 0.2) : mix(p.bg, p.accent, 0.25),
        "selected-row": p.fg,
        text: p.fg,
        subtext: ui.muted,
        button: p.accent,
        "button-active": ui.bright,
        "button-disabled": p.subtle,
        notification: p.info,
        "notification-error": p.error,
        misc: p.subtle,
        shadow: "#000000"
    };
}

function themeCss(p: Palette) {
    const { roundness } = settings.store;
    const ui = uiColors(p);
    const colors = spiceColors(p);
    const vars = Object.entries(colors)
        .flatMap(([name, value]) => [`--spice-${name}: ${value} !important;`, `--spice-rgb-${name}: ${rgb(value)} !important;`])
        .join("\n    ");

    return `
:root {
    ${vars}
    --spawn-accent: ${p.accent};
    --spawn-bright: ${ui.bright};
    --spawn-on-accent: ${ui.onAccent};
    --spawn-chat: ${p.bg};
    --spawn-sidebar: ${p.bgAlt};
    --spawn-surface: ${p.surface};
    --spawn-border: ${p.border};
    --spawn-hover: ${ui.hover};
    --spawn-selection: ${ui.selection};
    --spawn-scrollbar: ${p.category === "black" ? mix("#000000", ui.bright, 0.25) : mix(p.border, p.fg, 0.15)};
    --spawn-radius: ${roundness}px;
}

.encore-dark-theme,
.encore-dark-theme .encore-base-set,
.encore-light-theme,
.encore-light-theme .encore-base-set {
    --background-press: ${p.bg} !important;
    --background-elevated-press: ${mix(p.surface, "#000000", 0.2)} !important;
    --essential-subdued: ${p.subtle} !important;
    --decorative-subdued: ${p.border} !important;
    --text-negative: ${p.error} !important;
    --essential-negative: ${p.error} !important;
    --text-warning: ${p.warning} !important;
    --essential-warning: ${p.warning} !important;
    --text-announcement: ${p.info} !important;
    --essential-announcement: ${p.info} !important;
}

.encore-dark-theme .encore-bright-accent-set,
.encore-light-theme .encore-bright-accent-set {
    --background-base: ${p.accent} !important;
    --background-highlight: ${mix(p.accent, "#ffffff", 0.12)} !important;
    --background-press: ${mix(p.accent, "#000000", 0.15)} !important;
    --background-elevated-base: ${mix(p.accent, "#ffffff", 0.12)} !important;
    --background-elevated-highlight: ${mix(p.accent, "#ffffff", 0.12)} !important;
    --background-elevated-press: ${mix(p.accent, "#000000", 0.15)} !important;
    --background-tinted-base: ${alpha(p.accent, 0.9)} !important;
    --text-base: ${ui.onAccent} !important;
    --text-subdued: ${ui.onAccent} !important;
    --essential-base: ${ui.onAccent} !important;
    --decorative-subdued: ${mix(p.accent, "#000000", 0.15)} !important;
}
`;
}

function applyTheme() {
    if (!paletteStyle) return;

    paletteStyle.textContent = themeCss(getPalette());
}

export default defineTool({
    name: "Themes",
    title: "Themes",
    description: "The colour themes from Spawn's Toolkit for VS Code and Discord, with rounder corners",
    icon: "palette",
    settings,

    start() {
        paletteStyle = addStyle("spawn-themes");
        applyTheme();
        extras = addStyle("spawn-themes-extras", extrasStyle);
    },

    stop() {
        extras?.remove();
        extras = null;
        paletteStyle?.remove();
        paletteStyle = null;
    }
});
