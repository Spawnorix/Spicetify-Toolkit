import type { DefinedSettings } from "./settings";
import type { IconName } from "./ui/icons";

export interface Tool {
    name: string;
    title: string;
    description: string;
    icon: IconName;
    settings?: DefinedSettings<any>;
    needsReload?: boolean;
    started?: boolean;
    start(): void | Promise<void>;
    stop(): void;
}

export const defineTool = <T extends Tool>(tool: T) => tool;

export class Logger {
    constructor(private name: string) { }

    private line(level: "info" | "warn" | "error", args: unknown[]) {
        console[level](`[Spawn's Toolkit] [${this.name}]`, ...args);
    }

    info(...args: unknown[]) { this.line("info", args); }
    warn(...args: unknown[]) { this.line("warn", args); }
    error(...args: unknown[]) { this.line("error", args); }
}

export function addStyle(id: string, css = "") {
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
    return style;
}
