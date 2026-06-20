import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Translates mouse drags into 3D manipulation of a target Object3D, relative
// to the current camera view (so it works no matter how you've flown/rolled):
//   - move:   slide the target in the plane facing the camera, tracking the
//             cursor at the target's depth.
//   - rotate: spin the target about the camera's screen axes (trackball-ish).
// A single set of window-level listeners drives whichever drag is active.
// ---------------------------------------------------------------------------

const ROTATE_SPEED = 0.01; // radians per pixel

export function createDragManager(camera) {
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const forward = new THREE.Vector3();

    // active drag: { target, mode: 'move' | 'rotate', lastX, lastY }
    let drag = null;

    const refreshCameraBasis = () => {
        camera.updateMatrixWorld();
        camera.matrixWorld.extractBasis(right, up, forward);
    };

    function onMove(e) {
        if (!drag) return;
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        refreshCameraBasis();

        const target = drag.target;
        if (drag.mode === 'move') {
            // World units per screen pixel at the target's depth, so the
            // window stays glued to the cursor while dragging.
            const dist = target.position.distanceTo(camera.position);
            const worldPerPixel =
                (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist) /
                window.innerHeight;
            target.position.addScaledVector(right, dx * worldPerPixel);
            target.position.addScaledVector(up, -dy * worldPerPixel); // screen y is down
        } else {
            // Drag right -> yaw about the camera's up; drag down -> pitch about
            // the camera's right. Both pass through the target's centre.
            target.rotateOnWorldAxis(up, dx * ROTATE_SPEED);
            target.rotateOnWorldAxis(right, dy * ROTATE_SPEED);
        }
    }

    function onUp() {
        if (!drag) return;
        drag = null;
        document.body.classList.remove('dragging');
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    function begin(mode, target, e) {
        e.preventDefault();
        e.stopPropagation();
        drag = { target, mode, lastX: e.clientX, lastY: e.clientY };
        document.body.classList.add('dragging');
    }

    return {
        beginMove: (target, e) => begin('move', target, e),
        beginRotate: (target, e) => begin('rotate', target, e)
    };
}
