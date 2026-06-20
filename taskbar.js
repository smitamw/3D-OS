import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ---------------------------------------------------------------------------
// Windows-style taskbar, rendered as a CSS3DObject so it lives as a real,
// interactive HTML panel floating inside the 3D volume. No pointer lock — the
// Start button opens an app list, the clock ticks live, and grabbing the bar
// (anywhere but Start/menu) rotates the panel in place. It is rotatable but
// never draggable.
// ---------------------------------------------------------------------------

// CSS-pixel -> world-unit scale. The taskbar HTML is 1100x60px; at 0.06 that
// is ~66 x 3.6 world units inside the 200-unit volume.
const TASKBAR_SCALE = 0.06;

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
            <div class="start-menu-header">All apps</div>
            <div class="start-menu-list"></div>
        </div>
    `;

    const object = new CSS3DObject(el);
    object.scale.setScalar(TASKBAR_SCALE);
    object.position.set(0, -32, 0);

    // --- Start menu: a list of launchable apps -----------------------------
    const startBtn = el.querySelector('.start-btn');
    const menu = el.querySelector('.start-menu');
    const list = el.querySelector('.start-menu-list');

    const setOpen = (open) => {
        menu.classList.toggle('open', open);
        startBtn.classList.toggle('active', open);
    };

    apps.forEach((app) => {
        const item = document.createElement('button');
        item.className = 'start-item';
        item.type = 'button';
        item.innerHTML = `<span class="start-item-icon">${app.icon ?? '▦'}</span><span class="start-item-name"></span>`;
        item.querySelector('.start-item-name').textContent = app.name;
        item.addEventListener('click', () => {
            onLaunch(app);
            setOpen(false);
        });
        list.appendChild(item);
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
