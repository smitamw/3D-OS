import * as THREE from 'three';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { createTaskbar } from './taskbar.js';
import { createDragManager } from './dragManager.js';
import { createWindow } from './windows.js';
import { notepadApp, aboutApp, welcomeApp, youtubeApp, APP_REGISTRY } from './apps.js';

// ---------------------------------------------------------------------------
// 3D-OS bootstrap: a large, black-outlined volume you can free-fly inside of.
// All camera motion happens on the camera's LOCAL axes (quaternion-based), so
// there is no gimbal lock and movement always follows the current orientation.
//
// The Windows-style desktop chrome lives in a CSS3D layer on top of the WebGL
// volume: real, interactive HTML panels (starting with the taskbar) positioned
// as objects in the same scene, so they move/tilt/roll with the camera.
// ---------------------------------------------------------------------------

const SIZE = 200;            // edge length of the world volume
const HALF = SIZE / 2;
const MOVE_SPEED = 60;       // world units per second
const ROTATE_SPEED = 1.2;    // radians per second

// --- Renderer --------------------------------------------------------------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// CSS3D renderer for interactive HTML panels (taskbar, future windows). It
// draws the same scene/camera, transforming DOM elements into 3D space.
const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
cssRenderer.domElement.id = 'css3d';
document.body.appendChild(cssRenderer.domElement);

// --- Scene -----------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f4); // shown until the skybox texture below finishes loading

new THREE.TextureLoader().load('./skybox.png', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
});

// --- Camera (starts inside the volume) -------------------------------------
const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
);
camera.position.set(0, 0, HALF * 0.6); // near centre, pulled back to see helpers
camera.lookAt(0, 0, 0);

// --- Lighting --------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(1, 1.5, 1);
scene.add(sun);

// --- The volume: a large box outlined in black -----------------------------
const boxGeometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE);

// Faint interior walls so the box reads as an enclosed room from the inside.
const walls = new THREE.Mesh(
    boxGeometry,
    new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.04
    })
);
scene.add(walls);

// The black outline (12 edges of the box) — the requested outline.
const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(boxGeometry),
    new THREE.LineBasicMaterial({ color: 0x000000 })
);
scene.add(outline);

// --- Reference aids so all 6-DOF motion (incl. roll) is perceptible --------
const grid = new THREE.GridHelper(SIZE, 20, 0x000000, 0xb0b0b8);
grid.position.y = -HALF; // sit on the floor of the volume
scene.add(grid);

scene.add(new THREE.AxesHelper(HALF * 0.4)); // R/G/B = X/Y/Z at centre

// Scattered colored markers — give the eye fixed points to track.
const markerColors = [0xe81123, 0x0078d4, 0x107c10, 0xff8c00, 0x5c2d91, 0x008272];
const markerGeo = new THREE.BoxGeometry(10, 10, 10);
const markerPositions = [
    [-60, 40, -60], [60, -30, -50], [50, 50, 50], [-55, -50, 55],
    [0, 60, -70], [-70, 0, 20]
];
markerPositions.forEach((p, i) => {
    const marker = new THREE.Mesh(
        markerGeo,
        new THREE.MeshStandardMaterial({ color: markerColors[i % markerColors.length] })
    );
    marker.position.set(p[0], p[1], p[2]);
    scene.add(marker);
});

// --- Windows-style desktop chrome (CSS3D) ----------------------------------

// One drag manager drives window move/rotate AND taskbar rotate.
const dragManager = createDragManager(camera);

// Taskbar: rotatable (not draggable); Start opens the two-column app picker.
const taskbar = createTaskbar({ apps: APP_REGISTRY, onLaunch: launchApp, dragManager });
scene.add(taskbar.object);

// Per-window "rotate" actions (cube icon menu), shared by every window.
const windowActions = {
    faceMe: () => camera.quaternion,
    matchTaskbar: () => taskbar.object.quaternion
};

// Open a couple of windows on the desktop to start.
function spawnWindow(front, back, position) {
    const win = createWindow({ front, back, dragManager, position, actions: windowActions });
    scene.add(win.object);
    return win;
}
spawnWindow(notepadApp(), aboutApp(), [-22, 6, 5]);
spawnWindow(youtubeApp(), welcomeApp(), [22, 6, -5]);

// Spawn a window a short distance ahead of the camera, facing the user.
const _forward = new THREE.Vector3();
function spawnInFront(front, back) {
    camera.getWorldDirection(_forward);
    const pos = camera.position.clone().addScaledVector(_forward, 34);
    const win = createWindow({ front, back, dragManager, position: pos.toArray(), actions: windowActions });
    win.object.quaternion.copy(camera.quaternion); // face the user, match roll
    scene.add(win.object);
    return win;
}

// Launch from the Start menu: the chosen Front/Back apps go on the window's
// two faces (picked via the taskbar's two-column app picker).
function launchApp({ front, back }) {
    spawnInFront(front.make(), back.make());
}

// --- Input: track held keys by physical code (layout-independent) ----------
const pressed = new Set();
const NAV_CODES = new Set([
    'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'KeyR',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
]);

window.addEventListener('keydown', (e) => {
    // Don't steal keystrokes while typing in an app (e.g. Notepad).
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (NAV_CODES.has(e.code)) {
        pressed.add(e.code);
        e.preventDefault(); // stop arrows/space from scrolling the page
    }
});
window.addEventListener('keyup', (e) => {
    pressed.delete(e.code);
});
// Clear held keys if the window loses focus (avoids "stuck" keys).
window.addEventListener('blur', () => pressed.clear());

function applyControls(dt) {
    const move = MOVE_SPEED * dt;
    const rot = ROTATE_SPEED * dt;

    // Rotation about the camera's own axes (WASDQE -> pitch/yaw/roll).
    if (pressed.has('KeyW')) camera.rotateX(rot);   // pitch up
    if (pressed.has('KeyS')) camera.rotateX(-rot);  // pitch down
    if (pressed.has('KeyA')) camera.rotateY(rot);   // yaw left
    if (pressed.has('KeyD')) camera.rotateY(-rot);  // yaw right
    if (pressed.has('KeyQ')) camera.rotateZ(rot);   // roll left
    if (pressed.has('KeyE')) camera.rotateZ(-rot);  // roll right

    // Translation along the camera's own axes.
    if (pressed.has('ArrowUp')) camera.translateY(move);     // strafe up
    if (pressed.has('ArrowDown')) camera.translateY(-move);  // strafe down
    if (pressed.has('ArrowLeft')) camera.translateX(-move);  // strafe left
    if (pressed.has('ArrowRight')) camera.translateX(move);  // strafe right

    // Camera looks down its own -Z, so forward is -Z.
    if (pressed.has('KeyF')) camera.translateZ(-move);   // forward
    if (pressed.has('KeyR')) camera.translateZ(move);    // backward
}

// --- Resize handling -------------------------------------------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Render loop -----------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    applyControls(dt);
    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
}

animate();
