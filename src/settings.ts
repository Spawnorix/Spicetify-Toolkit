import { useEffect, useReducer } from "./react";

interface BaseDef {
    title?: string;
    description: string;
    hidden?: boolean;
    reloadNeeded?: boolean;
    onChange?(value: any): void;
}

export type SettingDef = BaseDef & (
    | { type: "boolean"; default: boolean; }
    | { type: "string"; default: string; }
    | { type: "number"; default: number; min?: number; max?: number; }
    | { type: "slider"; default: number; min: number; max: number; step?: number; unit?: string; }
    | { type: "select"; default: string; options: { label: string; value: string; }[]; }
);

type ValueOf<D extends SettingDef> = D["default"] extends boolean ? boolean : D["default"] extends number ? number : string;

export interface DefinedSettings<T extends Record<string, SettingDef> = Record<string, SettingDef>> {
    def: T;
    store: { [K in keyof T]: ValueOf<T[K]> };
}

const STORAGE_KEY = "spawns-toolkit:settings";

const defs: Record<string, SettingDef> = {};
const listeners = new Set<() => void>();
let values: Record<string, unknown> = {};

try {
    values = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") ?? {};
} catch {
    values = {};
}

const read = (key: string) => key in values ? values[key] : defs[key]?.default;

function write(key: string, value: unknown) {
    if (read(key) === value) return;
    values[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    try {
        defs[key]?.onChange?.(value);
    } finally {
        listeners.forEach(listener => listener());
    }
}

const store = new Proxy({}, {
    get: (_, key: string) => read(key),
    set: (_, key: string, value) => (write(key, value), true)
}) as Record<string, any>;

export function defineSettings<T extends Record<string, SettingDef>>(def: T): DefinedSettings<T> {
    Object.assign(defs, def);
    return { def, store: store as DefinedSettings<T>["store"] };
}

export function onSettingsChange(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

export function useSettings() {
    const [, update] = useReducer((n: number) => n + 1, 0);
    useEffect(() => onSettingsChange(update), []);
    return store;
}

export const visibleSettings = (settings: DefinedSettings | undefined) =>
    Object.entries(settings?.def ?? {}).filter(([, def]) => !def.hidden);
