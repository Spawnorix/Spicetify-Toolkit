import type { Tool } from "../tool";
import AdBlocker from "./adBlocker";
import Animations from "./animations";
import Backgrounds from "./backgrounds";
import LoopSong from "./loopSong";
import Themes from "./themes";

export const tools: Tool[] = [
    Themes,
    Backgrounds,
    Animations,
    AdBlocker,
    LoopSong,
];
