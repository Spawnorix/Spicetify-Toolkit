const DATABASE = "spawns-toolkit";
const STORE = "backgrounds";
export const MEDIA = /\.(png|jpe?g|webp|gif|mp4|webm)$/i;

let database: Promise<IDBDatabase> | undefined;

function open() {
    return database ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function listBackgrounds() {
    const names = await run("readonly", store => store.getAllKeys());
    return names.map(String).filter(name => MEDIA.test(name)).sort((a, b) => a.localeCompare(b));
}

export const readBackground = (name: string) => run<Blob | undefined>("readonly", store => store.get(name));

export const removeBackground = (name: string) => run("readwrite", store => store.delete(name));

export async function addBackgrounds() {
    const files = await new Promise<File[]>(resolve => {
        const input = Object.assign(document.createElement("input"), {
            type: "file",
            multiple: true,
            accept: ".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm"
        });
        input.addEventListener("change", () => resolve([...input.files ?? []]));
        input.addEventListener("cancel", () => resolve([]));
        input.click();
    });

    const media = files.filter(file => MEDIA.test(file.name));
    for (const file of media) {
        await run("readwrite", store => store.put(file.slice(0, file.size, file.type), file.name));
    }
    return media.length;
}

const IMPORTED_KEY = "spawns-toolkit:imported-backgrounds";

export async function importBundled(first: string, onAdded: (name: string) => void) {
    const index: { file: string; name: string; }[] | null = await fetch("/spawn-backgrounds/index.json")
        .then(response => response.ok ? response.json() : null)
        .catch(() => null);
    if (!Array.isArray(index)) return;

    let imported: string[] = [];
    try {
        imported = JSON.parse(localStorage.getItem(IMPORTED_KEY) || "[]");
    } catch { }

    const todo = index
        .filter(entry => MEDIA.test(entry.name) && !imported.includes(entry.name))
        .sort((a, b) => Number(b.name === first) - Number(a.name === first));

    for (const { file, name } of todo) {
        const response = await fetch(`/spawn-backgrounds/${file}`);
        if (!response.ok) throw new Error(`Spotify wouldn't hand over ${name} (${response.status})`);
        const blob = await response.blob();
        await run("readwrite", store => store.put(blob, name));
        imported.push(name);
        localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported));
        onAdded(name);
    }
}
