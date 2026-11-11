# Spicetify Toolkit

A [Spicetify](https://spicetify.app) extension that customises the Spotify desktop app, written in TypeScript and React. Open it with the wrench button in Spotify's top bar.

## Features

- **Themes:** colour themes applied across all of Spotify, with adjustable corner roundness
- **Backgrounds:** your own images or videos behind Spotify, with opacity, blur and panel darkness sliders. Files are stored in the browser's IndexedDB database
- **Animations:** page transitions, hover highlights, click ripples and menu animations, with a speed setting
- **Loop Song:** keeps the current song on repeat
- **Error Console:** errors and warnings from each tool, ready to copy
- **Ad Blocker:** based on [adblockify](https://github.com/rxri/spicetify-extensions) (MIT, licence in `src/tools/adBlocker/LICENSE`)

Every feature is a self-contained tool that can be switched on and off live. Its settings appear automatically in the settings panel.

## Setup

Requires [Spicetify](https://spicetify.app) and Node.js.

```
npm install
npm run apply
```

| Command | What it does |
|:--|:--|
| `npm run apply` | Builds, installs and applies the extension (Spotify restarts) |
| `npm run build` | Builds `dist/spawnsToolkit.js` |
| `npm run watch` | Rebuilds on every save |
| `npm run check` | Type-checks the project |

## Built with

TypeScript · React · CSS · IndexedDB · esbuild · Node.js
