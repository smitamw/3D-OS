# AGENTS.md — 3D-OS

A WebOS that aims to be **fully 3D**: a Windows-style desktop where the taskbar and every app window are real, interactive objects floating inside a 3D volume you free-fly through. Built with [THREE.js](https://threejs.org/) and plain ES modules — **no build step, no framework, no npm**.

---

## Quick start

The page uses ES-module imports + an import map pointing at a CDN, so it **must be served over HTTP** — opening `index.html` from `file://` will not work, and an internet connection is required (THREE.js loads from unpkg; the YouTube app loads from youtube.com).

This repo ships a zero-dependency PowerShell static server ([serve.ps1](serve.ps1)) — handy because this machine has **no Node and no Python** (so `npx serve` / `python -m http.server` aren't available):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1
# then open http://localhost:8000/ in a browser   (Ctrl+C to stop)
# optional: -Port 9000
```

It serves the repo root via `System.Net.HttpListener` with correct MIME types. Any other static file server works too — the only requirements are HTTP and a `text/javascript` content type for `.js`.

There are **no tests, no linter, and no CI**. "Verification" means loading the page in a browser and exercising the feature (see [Testing](#testing)).

---

## Tech stack & hard constraints

- **THREE.js r0.160.0**, loaded as an ES module from a CDN via an import map in [index.html](index.html):
  - `three` → `https://unpkg.com/three@0.160.0/build/three.module.js`
  - `three/addons/` → `https://unpkg.com/three@0.160.0/examples/jsm/`
- **`CSS3DRenderer`** (from `three/addons`) is central — it renders real HTML DOM as transformed objects in the 3D scene. This is how the taskbar and windows are "in 3D" yet remain fully interactive **without pointer lock** (the mouse cursor stays free for clicking/dragging UI).
- **No bundler / no transpile.** All `.js` files are native ES modules loaded directly by the browser. Keep imports CDN/relative; do not introduce `node_modules`-style bare specifiers beyond what the import map defines.
- If you change the THREE version, update **both** import-map entries (core + addons) together.

---

## Architecture: a dual-renderer scene

Everything lives in **one `THREE.Scene` / one `PerspectiveCamera`**, drawn every frame by **two renderers** over the same scene/camera:

| Layer | Renderer | DOM | z-index | Contains |
|-------|----------|-----|---------|----------|
| World | `WebGLRenderer` | `<canvas id="app">` | 0 | The volume (outlined box), faint walls, grid, axes, colored markers, **skybox** |
| Chrome | `CSS3DRenderer` | `<div id="css3d">` | 1 | Taskbar + all app windows (real interactive HTML as `CSS3DObject`s) |
| HUD | — (plain fixed DOM) | `<div id="legend">` | 10 | Screen-fixed controls legend |

Key consequences (and current limitations):
- The CSS3D layer always draws **on top of** the WebGL layer — there is **no mutual occlusion** between HTML panels and WebGL geometry. A window floating "behind" a marker still renders over it. Acceptable for now.
- `#css3d` has `pointer-events: none`; each interactive panel (`.taskbar`, `.win`) re-enables `pointer-events: auto`. This lets clicks on empty space fall through while panels stay clickable. (This is the documented `CSS3DRenderer` interaction pattern.)
- Because CSS3D panels are real DOM, **all of their styling lives in [index.html](index.html)'s `<style>` block**, not in JS.

The render loop ([main.js](main.js)) is a single `requestAnimationFrame` that applies camera input (delta-timed) then calls `renderer.render(...)` and `cssRenderer.render(...)`.

---

## File map

| File | Responsibility |
|------|----------------|
| [index.html](index.html) | The page shell: import map, the three DOM layers, the controls legend, and **all CSS** (taskbar, Start menu, windows, every app body — since CSS3D renders real DOM). |
| [main.js](main.js) | Entry point. Builds renderers, scene, volume, lights, helpers, skybox; wires the drag manager, taskbar, and initial windows; owns keyboard nav + the render loop. |
| [dragManager.js](dragManager.js) | `createDragManager(camera)` → `{ beginMove, beginRotate }`. Converts mouse drags into **camera-relative** 3D move/rotate of any `Object3D`. One shared instance drives windows **and** taskbar rotation. |
| [windows.js](windows.js) | `createWindow(...)` → a **two-sided** window (a different app per face) as a `THREE.Group` of two `CSS3DObject`s. Title bar = move, corners = rotate, cube icon = rotate-actions menu, ✕ = close. |
| [apps.js](apps.js) | The "applications" (`{ title, el, dispose? }` factories) and `APP_REGISTRY` (what the Start menu lists). |
| [taskbar.js](taskbar.js) | `createTaskbar(...)` → the floating taskbar: Start button → two-column app picker (Front/Back) + Launch, live clock, and grab-to-rotate (rotatable, never draggable). |
| [skybox.png](skybox.png) | 1774×887 equirectangular (2:1) panorama used as `scene.background`. |
| [serve.ps1](serve.ps1) | Zero-dependency PowerShell static dev server (no Node/Python needed). |
| [README.md](README.md) | One-line project description. |

---

## Core concepts

### Camera navigation (keyboard, local axes)
All movement is on the camera's **own local axes** (quaternion-based via `Object3D.rotateX/Y/Z` and `translateX/Y/Z`), so there's no gimbal lock and motion always follows the current orientation. Held keys are tracked in a `Set` by `event.code`; `applyControls(dt)` scales by `THREE.Clock` delta for frame-rate independence. The keydown handler **ignores nav keys while an `<input>`/`<textarea>`/contenteditable is focused**, so typing in apps (Notepad, the YouTube URL bar) doesn't fly the camera.

| Keys | Action |
|------|--------|
| `W`/`S` | pitch up/down |
| `A`/`D` | yaw left/right |
| `Q`/`E` | roll left/right |
| `↑`/`↓` | strafe up/down |
| `←`/`→` | strafe left/right |
| `F`/`R` | fly forward/backward |

### The drag system ([dragManager.js](dragManager.js))
- **Move**: slides the target in the plane facing the camera, tracking the cursor at the target's depth (world-units-per-pixel derived from FOV + distance).
- **Rotate**: `rotateOnWorldAxis` about the camera's screen up/right vectors (trackball-ish), through the target's center.
- Adds `body.dragging` for the drag's duration (used by CSS — e.g. to disable iframe hit-testing, see gotchas).
- Listeners are window-level, so a drag started on a small handle keeps tracking anywhere on screen.

### Two-sided windows ([windows.js](windows.js))
A window is a `THREE.Group` (scaled `0.05` CSS-px→world) holding **two `CSS3DObject` faces** back-to-back (`backface-visibility: hidden` flip-card trick; back face is `rotation.y = π` so its text reads correctly; a 1px `FACE_GAP` avoids z-fighting). Both faces share the same group, so move/rotate/close from either side affects the whole window. Title bar → `beginMove`, the four corners → `beginRotate`, the cube icon → a small actions menu (**"rotate to face me"** = match camera quaternion; **"rotate to start menu orientation"** = match the taskbar's current quaternion), ✕ → `dispose()` (runs each app's `dispose`, removes the DOM, detaches the group).

### App contract ([apps.js](apps.js))
Every app is a zero-arg factory returning:
```js
{ title: string, el: HTMLElement, dispose?: () => void }   // el fills the window body; dispose cleans up timers/etc.
```
`APP_REGISTRY` is an array of `{ name, icon, make }` — the single source of truth for what the Start menu offers. Current apps: **YouTube** (embedded `<iframe>` player with a URL/ID bar), **Notepad** (textarea), **Clock** (live), **About 3D-OS**, **Welcome**. `systemPanel(name)` is a generic back-face panel (currently unused by main, kept for reuse).

### Taskbar & Start menu ([taskbar.js](taskbar.js))
The taskbar is a single `CSS3DObject` at `(0, -32, 0)`. **Start** opens a popover with **two columns (Front / Back)**, each listing the full `APP_REGISTRY`; pick one app per column, then **Launch** spawns a window with those two apps on its two faces. Grabbing the bar (anywhere except Start/menu) calls `dragManager.beginRotate` — the taskbar **rotates but never moves**.

### Skybox ([main.js](main.js))
`scene.background` starts as a flat color (pre-load flash), then a `TextureLoader` loads [skybox.png](skybox.png) with `EquirectangularReflectionMapping` + `SRGBColorSpace` and assigns it as the background.

---

## How to add a new app (the most common task)

1. In [apps.js](apps.js), write a factory returning `{ title, el, dispose? }`. Build `el` with `document.createElement` / `innerHTML`; put any teardown (intervals, listeners) in `dispose`.
2. Add its CSS to the `<style>` block in [index.html](index.html) (give the body a unique class like `.app-myapp`).
3. Register it in `APP_REGISTRY`: `{ name: 'My App', icon: '🧩', make: myApp }` — it then appears in both Start columns automatically.
4. (Optional) Feature it in an initial desktop window via `spawnWindow(...)` in [main.js](main.js).

**Embedding external sites:** use an `<iframe>` in the app body (see `youtubeApp`). Only frameable URLs work (e.g. YouTube's `/embed/` form, not `watch` pages which send `X-Frame-Options`). The global `body.dragging iframe { pointer-events: none }` rule is what keeps window dragging working when the cursor crosses the iframe — keep it.

---

## Coding conventions

- **ES modules**, one concern per file; factories return plain objects, no classes needed.
- **4-space indentation**; `camelCase` for vars/functions; descriptive section-comment banners.
- Keep JS logic and **CSS for CSS3D panels separate**: behavior in the module, styling in [index.html](index.html).
- Inject untrusted text via `textContent`, not `innerHTML`.
- Dependency injection over globals: modules receive what they need (`camera`, `dragManager`, `actions`) as args rather than importing singletons — keep this pattern.
- Sizes are CSS pixels scaled into world units (windows `0.05`, taskbar `0.06`); the volume is 200 units (`SIZE`).

---

## Testing

No automated tests. To verify a change: serve the repo over HTTP, hard-refresh (`Ctrl+F5`, modules are cached), and exercise it in the browser. Quick smoke check: the outlined volume + skybox render, WASDQE/arrows/F/R fly the camera, windows drag (title bar) and rotate (corners), the cube menu reorients a window, and Start → pick Front/Back → Launch spawns a two-sided window facing you.

---

## Known caveats / gotchas

- **CSS3D over WebGL, no occlusion** — HTML panels always paint above the volume/markers.
- **Taskbar is single-sided** — rotating it past edge-on shows mirrored text on the back.
- **Start menu has no outside-click-to-close** — it closes via the Start toggle or on Launch.
- **iframe audio keeps playing when a window is flipped away** (the back face is hidden, but the iframe keeps running).
- **Corner rotate handles overlap the window's content corners** — grabbing an extreme corner rotates instead of interacting with the app there.
- **iframes in CSS 3D transforms** render correctly on Chromium/Firefox; Safari can be imperfect.
- **Everything needs the network** (THREE CDN + any embedded site). Offline → blank scene.
