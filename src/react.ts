import type * as ReactTypes from "react";

declare global {
    const Spicetify: {
        React: typeof ReactTypes;
        ReactDOM: any;
        Platform: any;
        Locale: any;
        CosmosAsync: any;
        Events: any;
        Topbar: any;
        Tippy: any;
        TippyProps: any;
        RemoteConfigResolver: any;
        createInternalMap: any;
        showNotification(text: string, isError?: boolean, msTimeout?: number): void;
    };
}

export type { CSSProperties, ReactNode } from "react";

const react = () => Spicetify.React;

export const h: typeof ReactTypes.createElement = ((...args: any[]) => (react().createElement as any)(...args)) as any;
export const Fragment = Symbol.for("react.fragment") as unknown as typeof ReactTypes.Fragment;

export const useState: typeof ReactTypes.useState = ((...args: any[]) => (react().useState as any)(...args)) as any;
export const useEffect: typeof ReactTypes.useEffect = (...args) => react().useEffect(...args);
export const useReducer: typeof ReactTypes.useReducer = ((...args: any[]) => (react().useReducer as any)(...args)) as any;
export const useRef: typeof ReactTypes.useRef = ((...args: any[]) => (react().useRef as any)(...args)) as any;

export function mount(node: ReactTypes.ReactNode, container: HTMLElement) {
    const { ReactDOM } = Spicetify;
    if (typeof ReactDOM.createRoot === "function") {
        const root = ReactDOM.createRoot(container);
        root.render(node);
        return () => root.unmount();
    }
    ReactDOM.render(node, container);
    return () => void ReactDOM.unmountComponentAtNode(container);
}
