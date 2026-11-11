import { defineTool, Logger } from "../../tool";

const logger = new Logger("LoopSong");

const REPEAT_TRACK = 2;

function loopCurrentSong() {
    try {
        (Spicetify as any).Player?.setRepeat?.(REPEAT_TRACK);
    } catch (e) {
        logger.error("Couldn't turn repeat-one on", e);
    }
}

export default defineTool({
    name: "LoopSong",
    title: "Loop Song",
    description: "Whatever song you play, it repeats on its own. Pick a different one and that loops instead",
    icon: "refresh",

    start() {
        loopCurrentSong();
        (Spicetify as any).Player?.addEventListener?.("songchange", loopCurrentSong);
        (Spicetify as any).Player?.addEventListener?.("onplaypause", loopCurrentSong);
    },

    stop() {
        (Spicetify as any).Player?.removeEventListener?.("songchange", loopCurrentSong);
        (Spicetify as any).Player?.removeEventListener?.("onplaypause", loopCurrentSong);
    }
});
