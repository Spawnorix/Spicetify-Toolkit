// Based on adblockify by ririxi (https://github.com/rxri/spicetify-extensions, MIT). The original license is in ./LICENSE

import { defineSettings } from "../../settings";
import { addStyle, defineTool, Logger } from "../../tool";

const logger = new Logger("AdBlocker");

export const settings = defineSettings({
    adBlockerHideUpgrade: {
        type: "boolean",
        title: "Hide Premium buttons",
        description: "Hides the Explore Premium button, the upgrade links in menus and the banners that ask you to upgrade",
        default: true,
        onChange: () => hideAdLikeElements()
    }
});

interface DisableManager {
    disable?(): void | Promise<void>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor<T>(get: () => T | undefined | null | false, interval = 100, tries = 100) {
    for (let i = 0; i < tries; i++) {
        const result = get();
        if (result) return result;
        await sleep(interval);
    }
    return get() || undefined;
}

async function disableManager(manager: DisableManager | undefined) {
    if (typeof manager?.disable === "function") await manager.disable();
}

function usesBigIntTimeInterval([major = 0, minor = 0, patch = 0]: number[]) {
    if (major !== 1) return major > 1;
    if (minor !== 2) return minor > 2;
    return patch >= 82;
}


async function loadModules() {
    const w = window as any;
    const chunks = await waitFor(() => w.rspackChunk || w.webpackChunkclient_web || w.rspackChunkclient_web, 50, 40);
    if (!chunks) throw new Error("Couldn't find Spotify's module list");

    const require = chunks.push([[Symbol()], {}, (re: any) => re]);
    const factories = new Set(Object.values(require.m));
    const classes: any[] = [];
    for (const id of Object.keys(require.m)) {
        let module: any;
        try {
            module = require(id);
        } catch {
            continue;
        }
        if (!module || typeof module !== "object") continue;
        for (const value of Object.values(module)) {
            if (typeof value === "function" && !factories.has(value)) classes.push(value);
        }
    }
    return classes;
}

function client(classes: any[], transport: unknown, name: string) {
    const Service = classes.find(c => c.SERVICE_ID === `spotify.ads.esperanto.proto.${name}`
        || c.SERVICE_ID === `spotify.ads.esperanto.${name.toLowerCase()}.proto.${name}`);
    if (!Service) {
        logger.warn(`Spotify's ${name} ad service wasn't found. Spotify probably changed it`);
        return null;
    }
    return new Service(transport);
}


let hideStyle: HTMLStyleElement | null = null;

function hideAdLikeElements() {
    if (!hideStyle) return;

    const ads = [
        "#leaderboard-ad-element",
        "#view-billboard-ad",
        '[data-testid="billboard-minimized"]',
        '[data-testid="billboard-image-link"]',
        '[data-testid*="hpto"]',
        '[data-testid="home-ads-container"]',
        '[data-testid*="home-ad-"]',
        '[data-testid*="leaderboard"]',
        '[data-testid="signup-bar"]',
        ".sponsor-container",
        ".main-leaderboardComponent-container",
        "div:has(> .main-leaderboardComponent-container)"
    ];

    const upgradeText: string | undefined = Spicetify.Locale?.get?.("upgrade.tooltip.title");
    const upgrade = [
        '[data-testid="upgrade-button"]',
        ".main-topBar-UpgradeButton",
        '[role="menuitem"]:has(a[href^="https://www.spotify.com/premium/"])',
        '[role="menu"] li:has(> a[href^="https://www.spotify.com/premium/"])',
        ...upgradeText ? [`button[title=${JSON.stringify(upgradeText)}]`, `button[aria-label=${JSON.stringify(upgradeText)}]`] : []
    ];

    const selectors = settings.store.adBlockerHideUpgrade ? [...ads, ...upgrade] : ads;
    hideStyle.textContent = `${selectors.join(",\n")} { display: none !important; }`;
}


async function block() {
    await waitFor(() => Spicetify?.Platform?.AdManagers?.audio && Spicetify.Platform.UserAPI, 100, 300);

    const { Platform } = Spicetify;
    const { AdManagers } = Platform;
    if (!AdManagers?.audio) throw new Error("Spotify's ad managers never loaded");

    const productState = Platform.UserAPI._product_state || Platform.UserAPI._product_state_service || Platform.ProductStateAPI?.productStateApi;
    if (!productState) throw new Error("Spotify's account state wasn't found");

    const version = String(Platform.version ?? "").split(".").map(part => parseInt(part));
    const classes = await loadModules();
    const { transport } = productState;
    const slotsClient = client(classes, transport, "Slots");
    const settingsClient = classes.length ? client(classes, transport, "Settings") : null;
    const testingClient = client(classes, transport, "Testing");

    let slots: { slotId?: string; slot_id?: string; }[] = [];
    try {
        slots = slotsClient ? (await slotsClient.getSlots()).adSlots : await Spicetify.CosmosAsync.get("sp://ads/v1/slots");
    } catch (e) {
        logger.warn("Couldn't list Spotify's ad slots, so only the ad managers are turned off", e);
    }
    const slotIds = slots.map(slot => slot.slotId || slot.slot_id).filter((id): id is string => !!id);

    const disableAds = () => productState
        .putOverridesValues({ pairs: { ads: "0", catalogue: "premium", product: "premium", type: "premium" } })
        .catch((e: unknown) => logger.error("Couldn't turn ads off in Spotify's account state", e));

    async function configureAdManagers() {
        try {
            const { audio, billboard, embeddedAd, inStreamApi, leaderboard, sponsoredPlaylist, vto } = AdManagers;

            setTimeout(disableAds, 100);

            if (testingClient) testingClient.addPlaytime({ seconds: -100000000000 });
            else await Spicetify.CosmosAsync.post("sp://ads/v1/testing/playtime", { value: -100000000000 });

            await disableManager(audio);
            audio.isNewAdsNpvEnabled = false;
            await disableManager(billboard);
            if (typeof leaderboard?.disableLeaderboard === "function") await leaderboard.disableLeaderboard();
            await disableManager(sponsoredPlaylist);
            await disableManager(inStreamApi);
            if (vto) {
                await disableManager(vto.manager);
                vto.isNewAdsNpvEnabled = false;
            }
            await disableManager(embeddedAd?.embeddedAdManager);
        } catch (e) {
            logger.error("Couldn't turn off Spotify's ad managers", e);
        }
    }

    async function updateSlotSettings(slotId: string) {
        if (!settingsClient) return;
        try {
            const timeInterval = usesBigIntTimeInterval(version) ? 0n : "0";
            await settingsClient.updateAdServerEndpoint({ slotIds: [slotId], url: "http://localhost/no/thanks" });
            await settingsClient.updateStreamTimeInterval({ slotId, timeInterval });
            await settingsClient.updateSlotEnabled({ slotId, enabled: false });
            await settingsClient.updateDisplayTimeInterval({ slotId, timeInterval });
        } catch (e) {
            logger.error(`Couldn't switch off the ad slot ${slotId}`, e);
        }
    }

    const retries = new Map<string, number>();

    function handleAdSlot(data: { adSlotEvent?: { slotId?: string; }; }) {
        const slotId = data?.adSlotEvent?.slotId;
        if (!slotId) return;

        try {
            const connector = AdManagers.audio?.inStreamApi?.adsCoreConnector;
            if (typeof connector?.clearSlot === "function") connector.clearSlot(slotId);
            slotsClient?.clearAllAds({ slotId });
            updateSlotSettings(slotId);
            retries.delete(slotId);
        } catch (e) {
            const count = (retries.get(slotId) ?? 0) + 1;
            retries.set(slotId, count);
            if (count > 5) {
                logger.error(`Couldn't empty the ad slot ${slotId} after 5 tries`, e);
                retries.delete(slotId);
                return;
            }
            setTimeout(handleAdSlot, 1000, data);
        }
        configureAdManagers();
    }

    for (const slotId of slotIds) {
        try {
            AdManagers.audio.inStreamApi.adsCoreConnector.subscribeToSlot(slotId, handleAdSlot);
        } catch (e) {
            logger.error(`Couldn't watch the ad slot ${slotId}`, e);
        }
        setTimeout(() => handleAdSlot({ adSlotEvent: { slotId } }), 50);
    }
    if (!slotIds.length) configureAdManagers();

    productState.subValues({ keys: ["ads", "catalogue", "product", "type"] }, () => configureAdManagers());

    turnOffAdFeatures();
    setTimeout(turnOffAdFeatures, 3000);
    setTimeout(() => slotIds.forEach(updateSlotSettings), 5000);

    logger.info(`Blocking ads in ${slotIds.length} slot${slotIds.length === 1 ? "" : "s"}`);
}

async function turnOffAdFeatures() {
    try {
        const overrides: Record<string, boolean> = {
            enableEsperantoMigration: true,
            enableInAppMessaging: false,
            hideUpgradeCTA: true,
            enablePremiumUserForMiniPlayer: true
        };

        const saved = JSON.parse(localStorage.getItem("spicetify-exp-features") || "{}");
        for (const [key, value] of Object.entries(overrides)) {
            if (typeof saved?.[key]?.value !== "undefined") saved[key].value = value;
        }
        localStorage.setItem("spicetify-exp-features", JSON.stringify(saved));

        const debug = Spicetify.Platform?.RemoteConfigDebugAPI;
        if (debug?.getProperties && debug.setOverride) {
            const properties: any[] = await debug.getProperties();
            for (const [key, value] of Object.entries(overrides)) {
                const ref = properties.find(p => p?.source === "web" && p?.type === "boolean" && p?.name === key);
                if (ref) await debug.setOverride({ ref, value }, { autoRunOverrideEffects: ref.localValue !== value });
            }
        } else if (debug?.setOverride) {
            for (const [key, value] of Object.entries(overrides)) {
                await debug.setOverride({ source: "web", type: "boolean", name: key }, value);
            }
        } else if (Spicetify.RemoteConfigResolver && typeof Spicetify.createInternalMap === "function") {
            Spicetify.RemoteConfigResolver.value.setOverrides(Spicetify.createInternalMap(overrides));
        }
    } catch (e) {
        logger.error("Couldn't change Spotify's ad feature switches", e);
    }
}

export default defineTool({
    name: "AdBlocker",
    title: "Ad Blocker",
    description: "Stops the audio ads between songs and removes the banners, sponsored playlists and upgrade buttons",
    icon: "shield",
    settings,
    needsReload: true,

    start() {
        hideStyle = addStyle("spawn-ad-blocker");
        hideAdLikeElements();
        block().catch(e => logger.error("The ad blocker couldn't start", e));
    },

    stop() {
        hideStyle?.remove();
        hideStyle = null;
    }
});
