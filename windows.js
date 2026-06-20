import * as THREE from 'three';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ---------------------------------------------------------------------------
// A window is a two-sided pane: two CSS3D faces back-to-back, each running its
// own app. `backface-visibility: hidden` means you only ever see the face
// turned toward you (classic flip-card trick). The two faces share one parent
// Group, so dragging the title bar (move) or a corner (rotate) on either side
// transforms the whole window.
// ---------------------------------------------------------------------------

const WINDOW_SCALE = 0.05; // CSS px -> world units
const FACE_GAP = 1;        // local px separation so the faces never z-fight

function buildFace(app, { beginMove, beginRotate, onClose, actions }) {
    const root = document.createElement('div');
    root.className = 'win';
    root.innerHTML = `
        <div class="win-titlebar">
            <button class="win-cube" type="button" title="Actions" aria-label="Actions">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 2 21 7 12 12 3 7Z"/>
                    <path d="M3 7 3 17 12 22 12 12Z"/>
                    <path d="M21 7 21 17 12 22 12 12Z"/>
                </svg>
            </button>
            <span class="win-title"></span>
            <button class="win-close" type="button" title="Close">&#10005;</button>
        </div>
        <div class="win-actions-menu" role="menu">
            <button class="win-action" data-action="faceMe" type="button">Rotate to face me</button>
            <button class="win-action" data-action="matchTaskbar" type="button">Rotate to start menu orientation</button>
        </div>
        <div class="win-body"></div>
        <div class="win-corner tl"></div>
        <div class="win-corner tr"></div>
        <div class="win-corner bl"></div>
        <div class="win-corner br"></div>
    `;
    root.querySelector('.win-title').textContent = app.title;
    root.querySelector('.win-body').appendChild(app.el);

    // Title bar = move handle (but let the cube/close buttons do their own thing).
    const titlebar = root.querySelector('.win-titlebar');
    titlebar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.win-close') || e.target.closest('.win-cube')) return;
        beginMove(e);
    });
    root.querySelector('.win-close').addEventListener('click', (e) => {
        e.stopPropagation();
        onClose();
    });

    // Cube icon = toggles a small "rotate" actions menu.
    const cubeBtn = root.querySelector('.win-cube');
    const actionsMenu = root.querySelector('.win-actions-menu');
    const setMenuOpen = (open) => {
        actionsMenu.classList.toggle('open', open);
        cubeBtn.classList.toggle('open', open);
    };

    cubeBtn.addEventListener('mousedown', (e) => e.stopPropagation()); // don't start a move drag
    cubeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setMenuOpen(!actionsMenu.classList.contains('open'));
    });

    actionsMenu.querySelectorAll('.win-action').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            actions?.[btn.dataset.action]?.();
            setMenuOpen(false);
        });
    });

    // Any other interaction on this face closes the actions menu.
    root.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.win-cube') && !e.target.closest('.win-actions-menu')) {
            setMenuOpen(false);
        }
    });

    // Corners = rotate handles. They sit after everything in the DOM, so they
    // win the hit-test over the title bar/body beneath them.
    root.querySelectorAll('.win-corner').forEach((corner) => {
        corner.addEventListener('mousedown', (e) => beginRotate(e));
    });

    return root;
}

export function createWindow({ front, back, dragManager, position = [0, 0, 0], onClosed, actions }) {
    const group = new THREE.Group();
    group.scale.setScalar(WINDOW_SCALE);
    group.position.fromArray(position);

    const handlers = {
        beginMove: (e) => dragManager.beginMove(group, e),
        beginRotate: (e) => dragManager.beginRotate(group, e),
        onClose: () => dispose(),
        actions: {
            faceMe: () => actions?.faceMe && group.quaternion.copy(actions.faceMe()),
            matchTaskbar: () => actions?.matchTaskbar && group.quaternion.copy(actions.matchTaskbar())
        }
    };

    const frontEl = buildFace(front, handlers);
    const backEl = buildFace(back, handlers);

    const frontObj = new CSS3DObject(frontEl);
    frontObj.position.z = FACE_GAP; // faces +Z (toward the start view)

    const backObj = new CSS3DObject(backEl);
    backObj.position.z = -FACE_GAP;
    backObj.rotation.y = Math.PI; // faces -Z, content stays readable

    group.add(frontObj, backObj);

    function dispose() {
        front.dispose?.();
        back.dispose?.();
        frontEl.remove(); // CSS3DRenderer won't reclaim orphaned DOM, so do it
        backEl.remove();
        group.removeFromParent();
        onClosed?.(group);
    }

    return { object: group, dispose };
}
