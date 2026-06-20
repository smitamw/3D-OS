import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ---------------------------------------------------------------------------
// Windows-style taskbar, rendered as a CSS3DObject so it lives as a real,
// interactive HTML panel floating inside the 3D volume. No pointer lock — the
// Start button opens a two-column app picker, the clock ticks live, and
// grabbing the bar (anywhere but Start/menu) rotates the panel in place. It
// is rotatable but never draggable.
//
// Start menu flow: pick one app for the Front column and one for the Back
// column, then Launch spawns a window with exactly those two apps on its two
// faces.
// ---------------------------------------------------------------------------

// CSS-pixel -> world-unit scale. The taskbar HTML is 1100x60px; at 0.06 that
// is ~66 x 3.6 world units inside the 200-unit volume.
const TASKBAR_SCALE = 0.06;

function buildColumn(label, apps, onSelect) {
    const col = document.createElement('div');
    col.className = 'start-col';
    col.innerHTML = `<div class="start-col-header">${label}</div><div class="start-col-list"></div>`;
    const list = col.querySelector('.start-col-list');

    let selectedBtn = null;

    apps.forEach((app) => {
        const item = document.createElement('button');
        item.className = 'start-item';
        item.type = 'button';
        item.innerHTML = `<span class="start-item-icon">${app.icon ?? '▦'}</span><span class="start-item-name"></span>`;
        item.querySelector('.start-item-name').textContent = app.name;
        item.addEventListener('click', () => {
            if (selectedBtn) selectedBtn.classList.remove('selected');
            selectedBtn = item;
            item.classList.add('selected');
            onSelect(app);
        });
        list.appendChild(item);
    });

    return {
        el: col,
        reset() {
            if (selectedBtn) selectedBtn.classList.remove('selected');
            selectedBtn = null;
        }
    };
}

export function createTaskbar({ apps = [], onLaunch = () => {}, dragManager } = {}) {
    const el = document.createElement('div');
    el.className = 'taskbar';
    el.innerHTML = `
        <button class="start-btn" type="button" aria-label="Start">
            <span class="win-logo"><i></i><i></i><i></i><i></i></span>
            <span class="start-label">Start</span>
        </button>
        <div class="taskbar-apps"></div>
        <div class="taskbar-clock">
            <div class="clock-time">--:--</div>
            <div class="clock-date">--/--/----</div>
        </div>
        <div class="start-menu" role="menu">
            <div class="start-columns"></div>
            <button class="start-launch" type="button" disabled>Launch</button>
        </div>
    `;

    const object = new CSS3DObject(el);
    object.scale.setScalar(TASKBAR_SCALE);
    object.position.set(0, -32, 0);

    // --- Start menu: two-column app picker + Launch -------------------------
    const startBtn = el.querySelector('.start-btn');
    const menu = el.querySelector('.start-menu');
    const columnsEl = el.querySelector('.start-columns');
    const launchBtn = el.querySelector('.start-launch');

    const setOpen = (open) => {
        menu.classList.toggle('open', open);
        startBtn.classList.toggle('active', open);
    };

    let picked = { front: null, back: null };

    const refreshLaunchEnabled = () => {
        launchBtn.disabled = !(picked.front && picked.back);
    };

    const frontCol = buildColumn('Front', apps, (app) => {
        picked.front = app;
        refreshLaunchEnabled();
    });
    const backCol = buildColumn('Back', apps, (app) => {
        picked.back = app;
        refreshLaunchEnabled();
    });
    columnsEl.append(frontCol.el, backCol.el);

    launchBtn.addEventListener('click', () => {
        if (!picked.front || !picked.back) return;
        onLaunch({ front: picked.front, back: picked.back });
        frontCol.reset();
        backCol.reset();
        picked = { front: null, back: null };
        refreshLaunchEnabled();
        setOpen(false);
    });

    startBtn.addEventListener('click', () => {
        setOpen(!menu.classList.contains('open'));
    });

    // --- Live clock --------------------------------------------------------
    const timeEl = el.querySelector('.clock-time');
    const dateEl = el.querySelector('.clock-date');
    const updateClock = () => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        dateEl.textContent = now.toLocaleDateString();
    };
    updateClock();
    const clockTimer = setInterval(updateClock, 1000);

    // --- Rotate (never move): grab the bar, but not the Start button/menu --
    if (dragManager) {
        el.addEventListener('mousedown', (e) => {
            if (e.target.closest('.start-btn') || e.target.closest('.start-menu')) return;
            dragManager.beginRotate(object, e);
        });
    }

    return {
        object,
        dispose() {
            clearInterval(clockTimer);
        }
    };
}
