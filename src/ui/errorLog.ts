export interface LogEntry {
    time: Date;
    level: "error" | "warn";
    text: string;
}

const MAX_ENTRIES = 300;
const IGNORED: string[] = [];
const entries: LogEntry[] = [];
const listeners = new Set<() => void>();
let keywords: string[] = [];
let original: { error: typeof console.error; warn: typeof console.warn; } | null = null;

export const getLog = () => entries;
export function onLogChange(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

export function clearLog() {
    entries.length = 0;
    listeners.forEach(l => l());
}

function describe(value: unknown): string {
    if (value instanceof Error) {
        const stack = value.stack?.split("\n").slice(1, 5).map(l => l.trim()).join("\n  ") ?? "";
        return `${value.name}: ${value.message}${stack ? `\n  ${stack}` : ""}`;
    }
    if (typeof value === "string") return value;
    if (value instanceof RegExp) return String(value);
    try {
        const json = JSON.stringify(value);
        return json && json.length > 500 ? `${json.slice(0, 500)}…` : String(json);
    } catch {
        return String(value);
    }
}

function format(args: unknown[]) {
    const parts = [...args];
    if (typeof parts[0] === "string" && parts[0].includes("%c")) {
        const styles = parts[0].split("%c").length - 1;
        parts[0] = parts[0].replaceAll("%c", "");
        parts.splice(1, styles);
    }
    return parts.map(describe).join(" ").replace(/\s{2,}/g, " ").trim();
}

export function addLogEntry(level: LogEntry["level"], text: string) {
    entries.push({ time: new Date(), level, text });
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    listeners.forEach(l => l());
}

function capture(level: LogEntry["level"], args: unknown[]) {
    try {
        const text = format(args);
        if (keywords.some(k => text.includes(k)) && !IGNORED.some(i => text.includes(i))) addLogEntry(level, text);
    } catch {
    }
}

const onWindowError = (e: ErrorEvent) => capture("error", [e.error ?? e.message]);
const onRejection = (e: PromiseRejectionEvent) => capture("error", ["Unhandled promise rejection:", e.reason]);

export function startErrorLog(names: string[]) {
    keywords = names;
    if (original) return;

    original = { error: console.error, warn: console.warn };
    const { error, warn } = original;
    console.error = function (...args: unknown[]) {
        capture("error", args);
        return error.apply(this, args);
    };
    console.warn = function (...args: unknown[]) {
        capture("warn", args);
        return warn.apply(this, args);
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onRejection);
}

export function stopErrorLog() {
    if (!original) return;
    console.error = original.error;
    console.warn = original.warn;
    original = null;
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onRejection);
}
