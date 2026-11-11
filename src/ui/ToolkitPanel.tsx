import { CSSProperties, Fragment, h, mount, ReactNode, useEffect, useReducer, useRef, useState } from "../react";
import { SettingDef, useSettings, visibleSettings } from "../settings";
import { addStyle, Tool } from "../tool";
import * as Backgrounds from "../tools/backgrounds";
import { getPalette, settings as themeSettings } from "../tools/themes";
import { Palette, PALETTES, THEME_CATEGORIES, ThemeCategory, uiColors } from "../tools/themes/palettes";
import { clearLog, getLog, onLogChange } from "./errorLog";
import { Icon } from "./icons";
import style from "./toolkit.css";

const cl = (...names: (string | false | undefined | null)[]) => names.filter(Boolean).map(name => `stk-${name}`).join(" ");

export interface ToolkitContext {
    tools: Tool[];
    isToolOn(tool: Tool): boolean;
    setToolOn(tool: Tool, enabled: boolean): void;
    brokenReason(tool: Tool): string | undefined;
    onHealthChange(listener: () => void): () => void;
}

let closePanel: (() => void) | undefined;

export function openToolkitPanel(ctx: ToolkitContext) {
    if (closePanel) return;

    addStyle("spawn-toolkit-window", style);
    const host = document.createElement("div");
    host.className = "stk-backdrop";
    document.body.append(host);

    let unmount = () => { };
    closePanel = () => {
        closePanel = undefined;
        host.classList.add("stk-closing");
        setTimeout(() => {
            unmount();
            host.remove();
        }, 150);
    };
    host.addEventListener("mousedown", e => e.target === host && closePanel?.());
    unmount = mount(<ToolkitPanel ctx={ctx} onClose={() => closePanel?.()} />, host);
}

const reload = () => {
    const restart = Spicetify.Platform?.LifecycleAPI?.restart;
    if (typeof restart === "function") restart.call(Spicetify.Platform.LifecycleAPI);
    else location.reload();
};

function paletteStyle(p: Palette) {
    const ui = uiColors(p);
    return {
        "--stk-bg": p.bg,
        "--stk-fg": p.fg,
        "--stk-muted": ui.muted,
        "--stk-sidebar": p.bgAlt,
        "--stk-card": p.surface,
        "--stk-border": p.border,
        "--stk-accent": p.accent,
        "--stk-accent-fg": ui.onAccent,
        "--stk-input": ui.input,
        "--stk-focus": ui.focus,
        "--stk-hover": ui.hover,
        "--stk-selected": ui.selected,
        "--stk-warning": p.warning
    } as CSSProperties;
}

function useBackgroundState() {
    const [, update] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
        const unsubscribe = Backgrounds.subscribe(update);
        Backgrounds.refreshBackgrounds();
        return unsubscribe;
    }, []);
    return Backgrounds.getBackgrounds();
}

function useToast() {
    const [toast, setToast] = useState<{ text: string; warning?: boolean; } | null>(null);
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 2200);
        return () => clearTimeout(timer);
    }, [toast]);
    return [toast, (text: string, warning?: boolean) => setToast({ text, warning })] as const;
}


function Switch({ checked, onChange, label }: { checked: boolean; onChange(checked: boolean): void; label: string; }) {
    return (
        <label className={cl("switch")} title={label}>
            <input type="checkbox" checked={checked} aria-label={label} onChange={e => onChange(e.currentTarget.checked)} />
            <span className={cl("track")} />
        </label>
    );
}

function Control({ id, def, value, onChange }: { id: string; def: SettingDef; value: any; onChange(value: any): void; }) {
    const title = def.title ?? id;

    switch (def.type) {
        case "boolean":
            return <Switch checked={!!value} label={title} onChange={onChange} />;
        case "slider":
            return (
                <div className={cl("slider")}>
                    <input
                        type="range"
                        min={def.min}
                        max={def.max}
                        step={def.step ?? 1}
                        value={Number(value)}
                        aria-label={title}
                        style={{ "--stk-fill": `${(Number(value) - def.min) / (def.max - def.min) * 100}%` } as CSSProperties}
                        onChange={e => onChange(Number(e.currentTarget.value))}
                    />
                    <span className={cl("slider-value")}>{value}{def.unit ?? ""}</span>
                </div>
            );
        case "number":
            return (
                <input
                    className={cl("input")}
                    type="number"
                    min={def.min}
                    max={def.max}
                    value={Number(value)}
                    aria-label={title}
                    onChange={e => {
                        const n = Number(e.currentTarget.value);
                        if (Number.isFinite(n)) onChange(Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, n)));
                    }}
                />
            );
        case "select":
            return (
                <select className={cl("input")} value={value} aria-label={title} onChange={e => onChange(e.currentTarget.value)}>
                    {def.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            );
        default:
            return <input className={cl("input")} type="text" value={value ?? ""} aria-label={title} onChange={e => onChange(e.currentTarget.value)} />;
    }
}

function SettingsCard({ tool, onReloadNeeded }: { tool: Tool; onReloadNeeded(): void; }) {
    const store = useSettings();
    const rows = visibleSettings(tool.settings);

    if (!rows.length) {
        return <div className={cl("card")}><div className={cl("row-empty")}>This tool has no settings.</div></div>;
    }

    return (
        <div className={cl("card")}>
            {rows.map(([key, def]) => (
                <div className={cl("row", "setting", def.type === "slider" && "setting-wide")} key={`${tool.name}.${key}`}>
                    <div className={cl("setting-text")}>
                        <div className={cl("setting-title")}>{def.title ?? key}</div>
                        <div className={cl("setting-description")}>{def.description}</div>
                    </div>
                    <Control
                        id={key}
                        def={def}
                        value={store[key]}
                        onChange={value => {
                            store[key] = value;
                            if (def.reloadNeeded) onReloadNeeded();
                        }}
                    />
                </div>
            ))}
        </div>
    );
}


function ThemePreview({ t }: { t: Palette; }) {
    const ui = uiColors(t);
    const c = (colour: string, text: string, style: CSSProperties = {}) => <span style={{ color: colour, ...style }}>{text}</span>;

    return (
        <div className={cl("tp")} style={{ background: t.bgAlt, borderColor: t.border }}>
            <div className={cl("tp-title")} style={{ background: t.bgAlt, borderColor: t.border, color: ui.muted }}>
                {["#ff5f57", "#febc2e", "#28c840"].map(colour => <span key={colour} className={cl("tp-dot")} style={{ background: colour }} />)}
                <span className={cl("tp-search")} style={{ background: t.surface, color: t.subtle }}>What do you want to play?</span>
            </div>
            <div className={cl("tp-main")}>
                <div className={cl("tp-side")} style={{ background: t.bgAlt, borderColor: t.border }}>
                    {[70, 55, 80, 45].map((width, i) => (
                        <span key={i} className={cl("tp-file")} style={{ width: `${width}%`, background: i === 1 ? ui.bright : t.subtle }} />
                    ))}
                </div>
                <div className={cl("tp-chat")} style={{ background: t.bg }}>
                    <div className={cl("tp-message")}>
                        <span className={cl("tp-cover")} style={{ background: `linear-gradient(135deg, ${t.accent}, ${ui.bright})` }} />
                        <div>
                            <div>{c(t.fg, "Liked Songs", { fontWeight: 700 })}</div>
                            <div>{c(ui.muted, "Spawn · 214 songs")}</div>
                        </div>
                        <span className={cl("tp-play")} style={{ background: t.accent, color: ui.onAccent }}>▶</span>
                    </div>
                    <div className={cl("tp-code")} style={{ background: t.surface, borderColor: t.border }}>
                        <div>{c(ui.bright, "1  Midnight Drive")}{c(t.subtle, "   3:02")}</div>
                        <div>{c(t.fg, "2  Neon Rain")}{c(t.subtle, "        4:11")}</div>
                    </div>
                </div>
            </div>
            <div className={cl("tp-player")} style={{ background: t.bgAlt, borderColor: t.border }}>
                <span className={cl("tp-bar")} style={{ background: t.subtle }}>
                    <span style={{ background: ui.bright }} />
                </span>
            </div>
        </div>
    );
}

function ThemesPage({ filter, onPick }: { filter: ThemeCategory | "all"; onPick(theme: Palette): void; }) {
    const active = getPalette().id;
    const themes = PALETTES.filter(theme => filter === "all" || theme.category === filter);
    const label = THEME_CATEGORIES.find(([id]) => id === filter)?.[1] ?? "All";
    const categoryLabel = (theme: Palette) => THEME_CATEGORIES.find(([id]) => id === theme.category)?.[1] ?? "Dark";

    return (
        <section className={cl("group")}>
            <div className={cl("gallery-bar")}>
                <h2 className={cl("group-title")}>{filter === "all" ? "All themes" : `${label} themes`}</h2>
            </div>
            {themes.length === 0 && <div className={cl("empty-state")}>No {label.toLowerCase()} themes yet.</div>}
            <div className={cl("gallery")}>
                {themes.map(theme => {
                    const isActive = theme.id === active;
                    return (
                        <button
                            key={theme.id}
                            className={cl("theme-card", isActive && "active")}
                            title={isActive ? "This is your current theme" : `Switch to ${theme.name}`}
                            onClick={() => !isActive && onPick(theme)}
                        >
                            <ThemePreview t={theme} />
                            <div className={cl("theme-info")}>
                                <div className={cl("theme-name")}>
                                    {theme.name}
                                    <span className={cl("theme-type")}>{categoryLabel(theme)}</span>
                                    {isActive && <span className={cl("theme-active")}><Icon name="check" size={12} />Active</span>}
                                </div>
                                <div className={cl("theme-description")}>{theme.description}</div>
                                <div className={cl("swatches")}>
                                    {(["bright", "keyword", "func", "string", "number", "typeName", "tag"] as const).map(key => (
                                        <span key={key} className={cl("swatch")} title={theme[key] ?? theme.accent} style={{ background: theme[key] ?? theme.accent }} />
                                    ))}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}


const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

function Media({ name, className, style }: { name: string; className: string; style?: CSSProperties; }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        Backgrounds.mediaUrl(name).then(u => alive && setUrl(u));
        return () => void (alive = false);
    }, [name]);

    if (!url) return <div className={className} style={style} />;
    if (Backgrounds.isVideo(name)) {
        return <video className={classes(className, cl("video"))} style={style} src={url} muted autoPlay loop playsInline />;
    }
    return <div className={className} style={{ ...style, backgroundImage: `url("${url}")` }} />;
}

interface BackgroundCardProps {
    active?: boolean;
    title: string;
    onClick(): void;
    thumb: ReactNode;
    label: string;
    sub?: string;
    onRemove?(): void;
    add?: boolean;
}

function BackgroundCard({ active, title, onClick, thumb, label, sub, onRemove, add }: BackgroundCardProps) {
    const [confirming, setConfirming] = useState(false);

    return (
        <div
            className={cl("bg-card", active && "active", add && "bg-card-add")}
            role="button"
            tabIndex={0}
            title={title}
            onClick={onClick}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && onClick()}
            onMouseLeave={() => setConfirming(false)}
        >
            {thumb}
            <div className={cl("bg-card-info")}>
                <div className={cl("bg-card-name")}>{label}</div>
                {active && <span className={cl("theme-active")}><Icon name="check" size={12} />Active</span>}
                {sub && <div className={cl("bg-card-sub")}>{sub}</div>}
            </div>
            {onRemove && (
                <button
                    className={cl("bg-remove", confirming && "confirming")}
                    title={confirming ? "Click again to remove it" : "Remove this background"}
                    onClick={e => {
                        e.stopPropagation();
                        if (confirming) onRemove();
                        else setConfirming(true);
                    }}
                >
                    {confirming ? "Remove?" : <Icon name="trash" size={14} />}
                </button>
            )}
        </div>
    );
}

function BackgroundsPage({ enabled, onNone, onChoose, toast }: { enabled: boolean; onNone(): void; onChoose(name: string): void; toast(text: string, warning?: boolean): void; }) {
    const { images, current } = useBackgroundState();
    const { backgroundImage, backgroundOpacity, backgroundBlur, backgroundBlend } = Backgrounds.settings.store;

    const base = (name: string) => name.replace(/\.[^.]+$/, "").toLowerCase();
    const sameFile = (a?: string, b?: string) => !!a && !!b && base(a) === base(b);
    const pinned = images.some(name => sameFile(name, backgroundImage)) ? backgroundImage : "";
    const showing = enabled ? (pinned || current || "") : "";
    const previewImage = images.find(name => sameFile(name, pinned || current)) ?? images[0];
    const blur = Number(backgroundBlur) || 0;

    const add = async () => {
        const added = await Backgrounds.addBackgrounds();
        if (added) toast(`Added ${added} background${added === 1 ? "" : "s"}`);
    };

    return (
        <>
            <section className={cl("group")}>
                <h2 className={cl("group-title")}>Preview</h2>
                <div className={cl("bg-preview")}>
                    <div className={cl("bg-preview-chat")}>
                        <div className={cl("bg-preview-message")}>
                            <span className={cl("tp-cover", "bg-preview-avatar")} />
                            <div>
                                <div><b className={cl("bg-preview-name")}>Liked Songs</b> <span className={cl("bg-preview-time")}>214 songs</span></div>
                                <div>Your background shows faintly behind everything, like this.</div>
                            </div>
                        </div>
                        <div className={cl("bg-preview-input")}>Midnight Drive · Spawn</div>
                    </div>
                    {previewImage && enabled && (
                        <Media
                            name={previewImage}
                            className={cl("bg-preview-image")}
                            style={{
                                opacity: (Number(backgroundOpacity) || 25) / 100,
                                mixBlendMode: backgroundBlend === "normal" ? "normal" : "screen",
                                filter: blur ? `blur(${blur}px)` : "",
                                inset: `${-blur * 2}px`
                            }}
                        />
                    )}
                    {(!previewImage || !enabled) && (
                        <div className={cl("bg-preview-empty")}>{enabled ? "Add a background to see it here" : "Backgrounds are off"}</div>
                    )}
                </div>
            </section>

            <section className={cl("group")}>
                <div className={cl("gallery-bar")}>
                    <h2 className={cl("group-title")}>Your backgrounds ({images.length})</h2>
                    <div className={cl("gallery-actions")}>
                        <button className={cl("ghost-button")} onClick={add}><Icon name="plus" />Add backgrounds…</button>
                        {images.length > 1 && (
                            <button className={cl("ghost-button")} onClick={() => enabled ? Backgrounds.nextBackground() : toast("Backgrounds are off", true)}>
                                <Icon name="arrowRight" />Next
                            </button>
                        )}
                    </div>
                </div>
                <div className={cl("bg-gallery")}>
                    <BackgroundCard
                        active={!enabled}
                        title="No background"
                        onClick={onNone}
                        thumb={<div className={cl("bg-thumb", "bg-thumb-none")}><Icon name="slash" size={28} /></div>}
                        label="None"
                    />
                    {images.length > 1 && (
                        <BackgroundCard
                            active={enabled && !pinned}
                            title="Pick from all your backgrounds, switching every few minutes if Cycle minutes is set below"
                            onClick={() => onChoose("")}
                            thumb={
                                <div className={cl("bg-thumb", "bg-thumb-shuffle")}>
                                    {images.slice(0, 4).map(name => <Media key={name} name={name} className={cl("bg-shuffle-tile")} />)}
                                </div>
                            }
                            label="Shuffle"
                            sub={enabled && !pinned && showing ? `Now: ${showing}` : "All your backgrounds"}
                        />
                    )}
                    {images.map(name => (
                        <BackgroundCard
                            key={name}
                            active={enabled && (pinned ? sameFile(pinned, name) : images.length === 1 && showing === name)}
                            title={`Use ${name}`}
                            onClick={() => onChoose(name)}
                            thumb={<Media name={name} className={cl("bg-thumb")} />}
                            label={name.replace(/\.[^.]+$/, "")}
                            sub={Backgrounds.isVideo(name) ? "Video" : undefined}
                            onRemove={() => Backgrounds.removeBackground(name).then(() => toast(`Removed ${name}`))}
                        />
                    ))}
                    <BackgroundCard
                        add
                        title="Add images and videos from your computer"
                        onClick={add}
                        thumb={<div className={cl("bg-thumb", "bg-thumb-none")}><Icon name="plus" size={28} /></div>}
                        label="Add backgrounds"
                    />
                </div>
                <p className={cl("hint")}>
                    The VS Code toolkit's backgrounds are copied in for you. Ones you add here are kept inside Spotify.
                </p>
            </section>
        </>
    );
}


const CONSOLE = "__error-console";

const timeOf = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function consoleText(ctx: ToolkitContext) {
    const broken = ctx.tools.filter(t => ctx.brokenReason(t)).map(t => `${t.name}: ${ctx.brokenReason(t)}`);
    const log = getLog().map(e => `[${timeOf(e.time)}] ${e.level.toUpperCase()} ${e.text}`);
    return [
        `Spawn's Toolkit for Spotify error console, ${new Date().toLocaleString()}`,
        `Spotify ${Spicetify.Platform?.version ?? "?"}`,
        `Broken tools: ${broken.length ? `\n${broken.join("\n")}` : "none"}`,
        `Log (${log.length}):\n${log.join("\n")}`
    ].join("\n\n");
}

function ErrorConsole({ ctx, toast }: { ctx: ToolkitContext; toast(text: string, warning?: boolean): void; }) {
    const log = getLog();
    const brokenTools = ctx.tools.filter(t => ctx.brokenReason(t));
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const body = bodyRef.current;
        if (body) body.scrollTop = body.scrollHeight;
    }, [log.length]);

    return (
        <div className={cl("content", "enter")}>
            <header className={cl("header")}>
                <div className={cl("header-icon")}><Icon name="terminal" size={26} /></div>
                <div>
                    <h1>Error Console</h1>
                    <p>Errors and warnings from your tools since Spotify started. Screenshot it or copy it to get a tool fixed</p>
                </div>
                <div className={cl("header-actions")}>
                    <button
                        className={cl("ghost-button")}
                        onClick={() => {
                            navigator.clipboard.writeText(consoleText(ctx)).then(() => toast("Copied the error console"), () => toast("Couldn't copy", true));
                        }}
                    >
                        <Icon name="copy" />Copy all
                    </button>
                    <button className={cl("ghost-button")} onClick={clearLog}>Clear</button>
                </div>
            </header>

            <section className={cl("group")}>
                <h2 className={cl("group-title")}>Broken tools ({brokenTools.length})</h2>
                <div className={cl("card")}>
                    {brokenTools.length === 0 && <div className={cl("row-empty")}>Nothing is broken.</div>}
                    {brokenTools.map(t => (
                        <div key={t.name} className={cl("row", "console-broken")}>
                            <div className={cl("console-broken-name")}><Icon name={t.icon} />{t.title}</div>
                            <div className={cl("console-broken-reason")}>{ctx.brokenReason(t)}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className={cl("group")}>
                <h2 className={cl("group-title")}>Log ({log.length})</h2>
                <div className={cl("terminal")}>
                    <div className={cl("terminal-titlebar")}>
                        <span className={cl("terminal-dot", "red")} />
                        <span className={cl("terminal-dot", "yellow")} />
                        <span className={cl("terminal-dot", "green")} />
                        <span className={cl("terminal-title")}>spawn's toolkit — console</span>
                    </div>
                    <div className={cl("terminal-body")} ref={bodyRef}>
                        {log.length === 0 && <div className={cl("terminal-line", "ok")}>No errors or warnings yet.</div>}
                        {log.map((entry, i) => (
                            <div key={i} className={cl("terminal-line", entry.level)}>
                                <span className={cl("terminal-time")}>{timeOf(entry.time)}</span>
                                <span className={cl("terminal-level")}>{entry.level === "error" ? "ERR" : "WRN"}</span>
                                <span className={cl("terminal-text")}>{entry.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}


function ToolkitPanel({ ctx, onClose }: { ctx: ToolkitContext; onClose(): void; }) {
    useSettings();
    const [, update] = useReducer((n: number) => n + 1, 0);
    useEffect(() => ctx.onHealthChange(update), []);
    useEffect(() => onLogChange(update), []);

    const [selected, setSelected] = useState(ctx.tools[0].name);
    const [themeFilter, setThemeFilter] = useState<ThemeCategory | "all">("all");
    const [themesOpen, setThemesOpen] = useState(false);
    const [reloadNeeded, setReloadNeeded] = useState(false);
    const [toast, showToast] = useToast();
    const { images } = useBackgroundState();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            onClose();
        };
        window.addEventListener("keydown", onKey, true);
        return () => window.removeEventListener("keydown", onKey, true);
    }, []);

    const onConsole = selected === CONSOLE;
    const logCount = getLog().length;
    const errorCount = getLog().filter(e => e.level === "error").length;

    const tool = ctx.tools.find(t => t.name === selected) ?? ctx.tools[0];
    const themesTool = ctx.tools.find(t => t.name === "Themes")!;
    const backgroundsTool = ctx.tools.find(t => t.name === "Backgrounds")!;
    const enabled = ctx.isToolOn(tool);
    const categories = THEME_CATEGORIES.filter(([id]) => id === "all" || PALETTES.some(theme => theme.category === id));

    const setToolOn = (target: Tool, on: boolean) => {
        ctx.setToolOn(target, on);
        if (target.needsReload) setReloadNeeded(true);
    };

    const count = (t: Tool) => {
        if (t === themesTool) return PALETTES.length;
        if (t === backgroundsTool) return images.length;
        return visibleSettings(t.settings).length;
    };

    const pickTheme = (theme: Palette) => {
        themeSettings.store.theme = theme.id;
        if (!ctx.isToolOn(themesTool)) setToolOn(themesTool, true);
        showToast(`Switched to ${theme.name}`);
    };

    const chooseBackground = (name: string) => {
        Backgrounds.settings.store.backgroundImage = name;
        if (!ctx.isToolOn(backgroundsTool)) setToolOn(backgroundsTool, true);
    };

    return (
        <div className={cl("window")} style={paletteStyle(getPalette())}>
            <aside className={cl("sidebar")}>
                <div className={cl("brand")}>
                    <div className={cl("brand-logo")}><Icon name="wrench" size={18} /></div>
                    <div>
                        <div className={cl("brand-name")}>Spawn's Toolkit</div>
                        <div className={cl("brand-sub")}>Settings</div>
                    </div>
                </div>

                <button className={cl("fix-button")} onClick={reload} title="Closes Spotify and opens it again. Your music stops for a moment">
                    <Icon name="refresh" />Restart Spotify
                </button>

                <div className={cl("nav-label")}>Tools</div>
                {ctx.tools.map(t => {
                    const isThemes = t === themesTool;
                    const active = !onConsole && t === tool && !(isThemes && themesOpen && themeFilter !== "all");
                    const n = count(t);
                    return (
                        <Fragment key={t.name}>
                            <button
                                className={cl("nav-item", active && "active", !ctx.isToolOn(t) && "off")}
                                title={ctx.isToolOn(t) ? t.description : `${t.description} (off)`}
                                onClick={() => {
                                    setSelected(t.name);
                                    if (isThemes) {
                                        setThemesOpen(open => t !== tool || !open);
                                        setThemeFilter("all");
                                    }
                                }}
                            >
                                <Icon name={t.icon} />
                                <span className={cl("nav-name")}>{t.title}</span>
                                {ctx.brokenReason(t)
                                    ? <span className={cl("count", "broken-count")} title="Broken">!</span>
                                    : n > 0 && <span className={cl("count")}>{n}</span>}
                                {isThemes && <Icon name="chevron" size={14} className={cl("nav-chevron", themesOpen && "open")} />}
                            </button>
                            {isThemes && themesOpen && (
                                <div className={cl("nav-sub")}>
                                    {categories.map(([id, label]) => (
                                        <button
                                            key={id}
                                            className={cl("nav-sub-item", !onConsole && tool === themesTool && themeFilter === id && "active")}
                                            onClick={() => {
                                                setSelected(themesTool.name);
                                                setThemeFilter(id);
                                            }}
                                        >
                                            {label}
                                            <span className={cl("nav-sub-count")}>{PALETTES.filter(theme => id === "all" || theme.category === id).length}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Fragment>
                    );
                })}

                <div className={cl("nav-label")}>Toolkit</div>
                <button
                    className={cl("nav-item", onConsole && "active")}
                    title="Errors and warnings from your tools, to send for fixing"
                    onClick={() => setSelected(CONSOLE)}
                >
                    <Icon name="terminal" />
                    <span className={cl("nav-name")}>Error Console</span>
                    {logCount > 0 && <span className={cl("count", errorCount > 0 && "broken-count")}>{logCount}</span>}
                </button>

                <div className={cl("sidebar-footer")}>Changes save as you make them</div>
            </aside>

            <main className={cl("main")}>
                {onConsole ? <ErrorConsole ctx={ctx} toast={showToast} /> : <div className={cl("content", "enter")} key={`${tool.name}.${themeFilter}`}>
                    <header className={cl("header")}>
                        <div className={cl("header-icon")}><Icon name={tool.icon} size={26} /></div>
                        <div>
                            <h1>{tool.title}</h1>
                            <p>{tool.description}</p>
                        </div>
                        <div className={cl("header-actions")}>
                            <label className={cl("ghost-button", "toggle")}>
                                {enabled ? "On" : "Off"}
                                <Switch checked={enabled} label={`Turn ${tool.title} ${enabled ? "off" : "on"}`} onChange={on => setToolOn(tool, on)} />
                            </label>
                        </div>
                    </header>

                    {reloadNeeded && (
                        <div className={cl("banner")}>
                            <Icon name="refresh" />
                            <span>Some changes need Spotify to restart before they take effect.</span>
                            <button className={cl("ghost-button")} onClick={reload}>Restart now</button>
                        </div>
                    )}

                    {ctx.brokenReason(tool) && (
                        <div className={cl("banner", "danger")}>
                            <Icon name="warning" />
                            <span>
                                This tool isn't running: {ctx.brokenReason(tool)}. Spotify probably updated.
                                The Error Console has the details, or ask Claude to fix it.
                            </span>
                        </div>
                    )}

                    {tool === themesTool && <ThemesPage filter={themeFilter} onPick={pickTheme} />}

                    {tool === backgroundsTool && (
                        <BackgroundsPage
                            enabled={ctx.isToolOn(backgroundsTool)}
                            onNone={() => setToolOn(backgroundsTool, false)}
                            onChoose={chooseBackground}
                            toast={showToast}
                        />
                    )}

                    <section className={cl("group")}>
                        <h2 className={cl("group-title")}>General</h2>
                        <SettingsCard tool={tool} onReloadNeeded={() => setReloadNeeded(true)} />
                    </section>
                </div>}
            </main>

            <button className={cl("close")} onClick={onClose} title="Close" aria-label="Close">
                <Icon name="close" size={18} />
            </button>

            <div className={cl("toast", toast && "show", toast?.warning && "warning")} role="status">
                <Icon name={toast?.warning ? "warning" : "check"} />
                {toast?.text}
            </div>
        </div>
    );
}
