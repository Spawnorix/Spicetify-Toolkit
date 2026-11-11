export type ThemeCategory = "black" | "dark" | "light";

export interface Palette {
    id: string;
    name: string;
    description: string;
    type: "dark" | "light";
    category: ThemeCategory;
    bg: string;
    bgAlt: string;
    surface: string;
    highlight: string;
    highlightBorder?: string;
    border: string;
    fg: string;
    muted: string;
    subtle: string;
    accent: string;
    bright?: string;
    comment: string;
    keyword: string;
    func: string;
    string: string;
    number: string;
    typeName: string;
    property: string;
    tag: string;
    operator: string;
    error: string;
    warning: string;
    info: string;
    success: string;
}

type Syntax = Pick<Palette, "comment" | "keyword" | "func" | "string" | "number" | "typeName" | "property" | "tag" | "operator"> & Partial<Pick<Palette, "info">>;

export const THEME_CATEGORIES: [ThemeCategory | "all", string][] = [
    ["all", "All"],
    ["black", "Full black"],
    ["dark", "Dark"],
    ["light", "Light"]
];

export function mix(a: string, b: string, amount: number) {
    const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
    return "#" + [1, 3, 5]
        .map(i => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * amount)
            .toString(16).padStart(2, "0"))
        .join("");
}

export function alpha(hex: string, opacity: number) {
    return hex + Math.round(opacity * 255).toString(16).padStart(2, "0");
}

function luminance(hex: string) {
    const [r, g, b] = [1, 3, 5].map(i => {
        const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function uiColors(p: Palette) {
    const bright = p.bright ?? p.accent;
    const black = p.category === "black";
    const grey = (level: string) => mix(level, bright, 0.08);
    const shade = (amount: number) => mix("#000000", bright, amount);

    return {
        bright,
        onAccent: luminance(p.accent) > 0.3 ? p.bgAlt : "#ffffff",
        muted: black ? grey("#8e8e8e") : p.muted,
        sideBarText: black ? grey("#b4b4b4") : p.fg,
        icon: black ? shade(0.7) : p.muted,
        hover: black ? alpha(bright, 0.07) : alpha(p.fg, 0.05),
        selected: black ? alpha(bright, 0.16) : alpha(p.accent, 0.2),
        inactiveSelected: black ? alpha(bright, 0.1) : alpha(p.accent, 0.12),
        focus: alpha(p.accent, 0.6),
        selection: alpha(p.accent, 0.35),
        input: p.type === "dark" ? p.bg : p.surface
    };
}

interface Scheme {
    id: string;
    name: string;
    description: string;
    category?: ThemeCategory;
    background: string;
    surface: string;
    cards: string;
    border: string;
    primary: string;
    accent: string;
    text: string;
    muted: string;
    syntax: Syntax;
}

function fromScheme({ id, name, description, category = "dark", background, surface, cards, border, primary, accent, text, muted, syntax }: Scheme): Palette {
    return {
        id,
        name,
        description,
        type: "dark",
        category,
        bg: surface,
        bgAlt: background,
        surface: cards,
        highlight: mix(surface, cards, 0.6),
        border,
        fg: text,
        muted,
        subtle: mix(muted, surface, 0.5),
        accent: primary,
        bright: accent,
        error: "#f87171",
        warning: "#fbbf24",
        info: accent,
        success: "#4ade80",
        ...syntax
    };
}

function hslToHex(h: number, s: number, l: number) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
        : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return "#" + [r, g, b]
        .map(v => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, "0"))
        .join("");
}

function contrastOnBlack(hex: string) {
    const [r, g, b] = [1, 3, 5].map(i => {
        const v = parseInt(hex.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05) / 0.05;
}

function vivid(hex: string, targetContrast: number) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    if (d === 0 || d / (1 - Math.abs(2 * l - 1)) < 0.1) {
        return hex;
    }
    let h = 60 * (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4);
    if (h < 0) {
        h += 360;
    }
    const s = Math.min(0.75, d / (1 - Math.abs(2 * l - 1)) + 0.1);

    let low = 0.25;
    let high = 0.95;
    for (let i = 0; i < 30; i++) {
        const mid = (low + high) / 2;
        if (contrastOnBlack(hslToHex(h, s, mid)) < targetContrast) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return hslToHex(h, s, (low + high) / 2);
}

function pureBlack({ id, name, description, primary, accent, syntax }: Pick<Scheme, "id" | "name" | "description" | "primary" | "accent" | "syntax">): Palette {
    return {
        ...fromScheme({
            id, name, description, primary, accent, syntax,
            category: "black",
            background: "#000000", surface: "#000000", cards: "#000000",
            border: mix("#1f1f1f", accent, 0.08),
            text: mix("#ececec", accent, 0.05),
            muted: mix("#8a8a8a", accent, 0.12)
        }),
        keyword: syntax.keyword.toLowerCase() === accent.toLowerCase() ? accent : vivid(syntax.keyword, 7.5),
        func: vivid(syntax.func, 10),
        string: vivid(syntax.string, 9.5),
        number: vivid(syntax.number, 8.5),
        typeName: vivid(syntax.typeName, 9),
        tag: vivid(syntax.tag, 7),
        comment: mix(syntax.comment, "#a0a0a0", 0.3),
        highlight: "#000000",
        highlightBorder: mix("#1c1c1c", accent, 0.08),
        error: "#ff5f6d",
        warning: "#f5c76a",
        info: "#7ab8ff",
        success: "#7ee2a8"
    };
}

export const PALETTES: Palette[] = [
    {
        id: "midnight",
        name: "Midnight",
        description: "Deep blue-black with violet accents. Clean and modern.",
        type: "dark",
        category: "dark",
        bg: "#0f1117",
        bgAlt: "#0a0c10",
        surface: "#161923",
        highlight: "#161a24",
        border: "#1e2230",
        fg: "#d7dae0",
        muted: "#8b91a1",
        subtle: "#454b5e",
        accent: "#8b7cf6",
        comment: "#5c6378",
        keyword: "#c099ff",
        func: "#7aa2f7",
        string: "#9ece6a",
        number: "#ff9e64",
        typeName: "#2ac3de",
        property: "#73daca",
        tag: "#f7768e",
        operator: "#89ddff",
        error: "#f7768e",
        warning: "#e0af68",
        info: "#7aa2f7",
        success: "#9ece6a"
    },
    {
        id: "faded-memories",
        name: "Faded Memories",
        description: "Dusty rose, sage and mauve on soft charcoal. Calm and moody.",
        type: "dark",
        category: "dark",
        bg: "#1c1a1d",
        bgAlt: "#161417",
        surface: "#242126",
        highlight: "#232025",
        border: "#2e2a31",
        fg: "#ddd3cb",
        muted: "#a0959b",
        subtle: "#5a525d",
        accent: "#d4a5a5",
        comment: "#6e6573",
        keyword: "#c9a0c9",
        func: "#a8c0d6",
        string: "#b9c7a3",
        number: "#e0b48a",
        typeName: "#9fc4c0",
        property: "#d6bfa7",
        tag: "#d49a9a",
        operator: "#b8acbb",
        error: "#e08b8b",
        warning: "#e0b48a",
        info: "#a8c0d6",
        success: "#b9c7a3"
    },
    {
        id: "forest",
        name: "Forest",
        description: "Dark green-black with fresh greens and warm highlights.",
        type: "dark",
        category: "dark",
        bg: "#111714",
        bgAlt: "#0c110e",
        surface: "#17201b",
        highlight: "#16201b",
        border: "#203029",
        fg: "#d3dfd6",
        muted: "#8fa396",
        subtle: "#47594e",
        accent: "#5fd38d",
        comment: "#5b6e62",
        keyword: "#e6b36b",
        func: "#6fcfb0",
        string: "#a9d67e",
        number: "#f09a6e",
        typeName: "#d9c68a",
        property: "#8fc7d1",
        tag: "#e08c8c",
        operator: "#9fb8a8",
        error: "#e57373",
        warning: "#e6b36b",
        info: "#8fc7d1",
        success: "#5fd38d"
    },
    fromScheme({
        id: "obsidian-purple",
        name: "Obsidian Purple",
        description: "Luxury, mysterious, premium.",
        background: "#07060b", surface: "#0e0b14", cards: "#15101d", border: "#292033",
        primary: "#8b5cf6", accent: "#b58cff", text: "#f5f3ff", muted: "#918a9e",
        syntax: {
            comment: "#5e5470", keyword: "#b58cff", func: "#8ec5ff", string: "#c3e88d", number: "#f7b267",
            typeName: "#f0abfc", property: "#a5b4fc", tag: "#ff7ab6", operator: "#c4b5fd"
        }
    }),
    fromScheme({
        id: "midnight-blue",
        name: "Midnight Blue",
        description: "Expensive tech, futuristic.",
        background: "#05070d", surface: "#090d18", cards: "#101725", border: "#1c293d",
        primary: "#3b82f6", accent: "#60a5fa", text: "#f1f5f9", muted: "#8491a7",
        syntax: {
            comment: "#4b5a73", keyword: "#818cf8", func: "#60a5fa", string: "#86efac", number: "#fdba74",
            typeName: "#67e8f9", property: "#93c5fd", tag: "#f472b6", operator: "#7dd3fc"
        }
    }),
    fromScheme({
        id: "black-cherry",
        name: "Black Cherry",
        description: "Dark, aggressive, elegant.",
        background: "#080506", surface: "#10090b", cards: "#180d10", border: "#302025",
        primary: "#b91c3b", accent: "#f43f5e", text: "#fff1f3", muted: "#a68b91",
        syntax: {
            comment: "#5e4249", keyword: "#f43f5e", func: "#fdba74", string: "#f9a8d4", number: "#fcd34d",
            typeName: "#ffb4a2", property: "#e9d5da", tag: "#fb7185", operator: "#d6a3ae"
        }
    }),
    fromScheme({
        id: "void-violet",
        name: "Void Violet",
        description: "Dark fantasy, premium marketplace.",
        background: "#030205", surface: "#0a0710", cards: "#110b19", border: "#24172f",
        primary: "#7c3aed", accent: "#c084fc", text: "#faf7ff", muted: "#8f849b",
        syntax: {
            comment: "#574a66", keyword: "#c084fc", func: "#93c5fd", string: "#f0abfc", number: "#fda4af",
            typeName: "#67e8f9", property: "#ddd6fe", tag: "#f472b6", operator: "#a5b4fc"
        }
    }),
    fromScheme({
        id: "black-silver",
        name: "Black + Silver",
        description: "Extremely clean, expensive, minimalist.",
        background: "#050505", surface: "#0c0c0c", cards: "#141414", border: "#292929",
        primary: "#a3a3a3", accent: "#e5e5e5", text: "#ffffff", muted: "#737373",
        syntax: {
            comment: "#525252", keyword: "#a3a3a3", func: "#f5f5f5", string: "#b5c4b1", number: "#d6c3a5",
            typeName: "#bac8d6", property: "#cfcfcf", tag: "#d4a5a5", operator: "#8a8a8a",
            info: "#bac8d6"
        }
    }),
    fromScheme({
        id: "dark-emerald",
        name: "Dark Emerald",
        description: "Money, wealth, vault.",
        background: "#030806", surface: "#07100c", cards: "#0b1711", border: "#183025",
        primary: "#10b981", accent: "#34d399", text: "#ecfdf5", muted: "#789589",
        syntax: {
            comment: "#3e5a4d", keyword: "#34d399", func: "#67e8f9", string: "#d9f99d", number: "#fcd34d",
            typeName: "#5eead4", property: "#a7f3d0", tag: "#fca5a5", operator: "#6ee7b7"
        }
    }),
    fromScheme({
        id: "blackout-gold",
        name: "Blackout Gold",
        description: "Rich, vault, exclusive marketplace.",
        background: "#050505", surface: "#0c0b08", cards: "#14120c", border: "#302a1b",
        primary: "#c9a227", accent: "#f1c75b", text: "#fffdf5", muted: "#968d76",
        syntax: {
            comment: "#5c5440", keyword: "#f1c75b", func: "#f5e6b8", string: "#b8c98a", number: "#f59e6c",
            typeName: "#e6a57e", property: "#d9cba3", tag: "#e07a5f", operator: "#c9a227"
        }
    }),
    fromScheme({
        id: "deep-ocean",
        name: "Deep Ocean",
        description: "Underwater, futuristic, mysterious.",
        background: "#020609", surface: "#061016", cards: "#0a1820", border: "#14303b",
        primary: "#06b6d4", accent: "#67e8f9", text: "#ecfeff", muted: "#71939a",
        syntax: {
            comment: "#3d5a63", keyword: "#22d3ee", func: "#93c5fd", string: "#a7f3d0", number: "#fdba74",
            typeName: "#c4b5fd", property: "#bae6fd", tag: "#f9a8d4", operator: "#5ec4d4"
        }
    }),
    fromScheme({
        id: "ember",
        name: "Ember",
        description: "Dark fire, powerful, gaming.",
        background: "#080504", surface: "#120a07", cards: "#1a0f0a", border: "#352018",
        primary: "#ea580c", accent: "#fb923c", text: "#fff7ed", muted: "#a88b7d",
        syntax: {
            comment: "#6b5045", keyword: "#fb923c", func: "#fcd34d", string: "#c3d37a", number: "#fdba74",
            typeName: "#fde68a", property: "#fed7aa", tag: "#f87171", operator: "#e7b9a0"
        }
    }),
    fromScheme({
        id: "cyber-void",
        name: "Cyber Void",
        description: "Futuristic, cyberpunk.",
        background: "#030307", surface: "#080812", cards: "#0d0d1c", border: "#20203a",
        primary: "#6366f1", accent: "#22d3ee", text: "#f8fafc", muted: "#81859b",
        syntax: {
            comment: "#4a4d6b", keyword: "#d946ef", func: "#22d3ee", string: "#a3e635", number: "#fbbf24",
            typeName: "#818cf8", property: "#c7d2fe", tag: "#f472b6", operator: "#a5b4fc"
        }
    }),
    fromScheme({
        id: "true-black-crimson",
        name: "True Black + Crimson",
        description: "Very clean, gaming.",
        background: "#000000", surface: "#080808", cards: "#101010", border: "#242424",
        primary: "#dc2626", accent: "#ff4545", text: "#ffffff", muted: "#888888",
        syntax: {
            comment: "#4a4a4a", keyword: "#ff4545", func: "#ffb4b4", string: "#c9c9c9", number: "#ff8a65",
            typeName: "#ffd1d1", property: "#bdbdbd", tag: "#ff4545", operator: "#a3a3a3",
            info: "#bdbdbd"
        }
    }),
    pureBlack({
        id: "pure-black",
        name: "Pure Black",
        description: "True #000000 everywhere, white accents, soft pastel code.",
        primary: "#ffffff", accent: "#ffffff",
        syntax: {
            keyword: "#c4a7ff", func: "#7cc7ff", string: "#a5e8a0", number: "#ff8f7a",
            typeName: "#ffd479", property: "#a8e6e6", tag: "#ff8fa3", operator: "#8f8f8f", comment: "#5c5c5c"
        }
    }),
    pureBlack({
        id: "pure-black-crimson",
        name: "Pure Black Crimson",
        description: "True #000000 everywhere with crimson accents.",
        primary: "#dc2626", accent: "#ff4545",
        syntax: {
            keyword: "#ff5468", func: "#f5c76a", string: "#9fe6c0", number: "#c9a8ff",
            typeName: "#9cc8ff", property: "#e8d6d8", tag: "#ff6b7c", operator: "#a08487", comment: "#5f4a4d"
        }
    }),
    pureBlack({
        id: "pure-black-gold",
        name: "Pure Black Gold",
        description: "True #000000 everywhere with gold accents.",
        primary: "#c9a227", accent: "#f1c75b",
        syntax: {
            keyword: "#f1c75b", func: "#9ed8c8", string: "#cbd88c", number: "#ff8f7a",
            typeName: "#c7a8ff", property: "#ebdfc4", tag: "#e8836a", operator: "#a3966f", comment: "#5e5643"
        }
    }),
    pureBlack({
        id: "pure-black-silver",
        name: "Pure Black Silver",
        description: "True #000000 everywhere with silver accents. Minimal.",
        primary: "#a3a3a3", accent: "#e5e5e5",
        syntax: {
            keyword: "#b9c6d8", func: "#ffffff", string: "#adc9a6", number: "#dcc4a2",
            typeName: "#d0c0ec", property: "#d2d2d2", tag: "#dcaaaa", operator: "#868686", comment: "#555555"
        }
    }),
    pureBlack({
        id: "pure-black-violet",
        name: "Pure Black Violet",
        description: "True #000000 everywhere with violet accents.",
        primary: "#8b5cf6", accent: "#b58cff",
        syntax: {
            keyword: "#b58cff", func: "#8ec8ff", string: "#a9e6a2", number: "#ffb877",
            typeName: "#f2aefc", property: "#cfc8ff", tag: "#ff80b9", operator: "#9488b0", comment: "#594e6e"
        }
    }),
    pureBlack({
        id: "pure-black-blue",
        name: "Pure Black Blue",
        description: "True #000000 everywhere with electric blue accents.",
        primary: "#3b82f6", accent: "#60a5fa",
        syntax: {
            keyword: "#8fa2ff", func: "#5ecbff", string: "#90e6b2", number: "#ffb47c",
            typeName: "#c6a9ff", property: "#bad6ff", tag: "#ff8abb", operator: "#7d8eb0", comment: "#485670"
        }
    }),
    pureBlack({
        id: "pure-black-rose",
        name: "Pure Black Rose",
        description: "True #000000 everywhere with rose-pink accents.",
        primary: "#be185d", accent: "#ff5c8a",
        syntax: {
            keyword: "#ff5c8a", func: "#c9a8ff", string: "#f2d08f", number: "#ff9c7a",
            typeName: "#8fd3ff", property: "#eed6de", tag: "#ff7a9c", operator: "#a88a95", comment: "#5f4751"
        }
    }),
    pureBlack({
        id: "pure-black-emerald",
        name: "Pure Black Emerald",
        description: "True #000000 everywhere with emerald accents.",
        primary: "#10b981", accent: "#34d399",
        syntax: {
            keyword: "#34d399", func: "#80d6fc", string: "#e1f4a2", number: "#fcd34d",
            typeName: "#a9b6fc", property: "#bcf0da", tag: "#fca5a5", operator: "#6f9c8a", comment: "#405b4f"
        }
    }),
    pureBlack({
        id: "pure-black-ocean",
        name: "Pure Black Ocean",
        description: "True #000000 everywhere with cyan accents.",
        primary: "#06b6d4", accent: "#67e8f9",
        syntax: {
            keyword: "#2fd8f0", func: "#96c7ff", string: "#a9f2d0", number: "#fdbb78",
            typeName: "#c7b8ff", property: "#cbeef7", tag: "#f9aad5", operator: "#63a0ab", comment: "#3f5c64"
        }
    }),
    pureBlack({
        id: "pure-black-ember",
        name: "Pure Black Ember",
        description: "True #000000 everywhere with fiery orange accents.",
        primary: "#ea580c", accent: "#fb923c",
        syntax: {
            keyword: "#ff8a3d", func: "#ffe27a", string: "#c6df82", number: "#ff9ec8",
            typeName: "#8ad4c8", property: "#f3dec8", tag: "#ff6b6b", operator: "#b5917c", comment: "#6a5146"
        }
    }),
    pureBlack({
        id: "pure-black-cyber",
        name: "Pure Black Cyber",
        description: "True #000000 everywhere with indigo and cyan. Cyberpunk.",
        primary: "#6366f1", accent: "#22d3ee",
        syntax: {
            keyword: "#e45cff", func: "#22e3ff", string: "#b6f05e", number: "#ffc541",
            typeName: "#9293ff", property: "#cad4ff", tag: "#ff62ab", operator: "#8f94c9", comment: "#4c4f6e"
        }
    }),
    pureBlack({
        id: "pure-black-gothic",
        name: "Pure Black Gothic",
        description: "True #000000 everywhere with magenta and purple.",
        primary: "#a855f7", accent: "#e879f9",
        syntax: {
            keyword: "#e879f9", func: "#c7b8fd", string: "#ebd7a4", number: "#fda7b2",
            typeName: "#9fd8f0", property: "#e6d6f2", tag: "#f475b8", operator: "#a690b2", comment: "#5b4c62"
        }
    }),
    fromScheme({
        id: "dark-gothic",
        name: "Dark Gothic",
        description: "Candlelit purples and pinks in the dark.",
        background: "#060508", surface: "#0d0a10", cards: "#151019", border: "#2b2030",
        primary: "#a855f7", accent: "#e879f9", text: "#f9f5fa", muted: "#918694",
        syntax: {
            comment: "#5a4b60", keyword: "#e879f9", func: "#c4b5fd", string: "#e9d5a1", number: "#fda4af",
            typeName: "#c084fc", property: "#ddd6fe", tag: "#f472b6", operator: "#d8b4fe"
        }
    })
];
