// ---------------------------------------------------------------------------
// Demo "applications". Each returns { title, el, dispose? } — `el` is the DOM
// that fills a window's body. Two of these go on the two sides of one window.
// ---------------------------------------------------------------------------

export function notepadApp() {
    const el = document.createElement('textarea');
    el.className = 'app-notepad';
    el.spellcheck = false;
    el.value =
        'Type here…\n\n' +
        'This pane is the FRONT side of a two-sided 3D window.\n' +
        'Drag the title bar to move it, or grab a corner to spin it ' +
        'around and reveal the app on the other side.';
    return { title: 'Notepad', el };
}

export function aboutApp() {
    const el = document.createElement('div');
    el.className = 'app-about';
    el.innerHTML = `
        <h2>3D-OS</h2>
        <p>A WebOS that aims to be fully 3D.</p>
        <ul>
            <li>Every window is a two-sided pane.</li>
            <li>Drag the <b>title bar</b> to move it through space.</li>
            <li>Drag any <b>corner</b> to rotate it in 3D.</li>
        </ul>
        <p class="muted">build · spatial-windows</p>
    `;
    return { title: 'About 3D-OS', el };
}

export function clockApp() {
    const el = document.createElement('div');
    el.className = 'app-clock';
    const time = document.createElement('div');
    time.className = 'app-clock-time';
    const date = document.createElement('div');
    date.className = 'app-clock-date';
    el.append(time, date);

    const tick = () => {
        const now = new Date();
        time.textContent = now.toLocaleTimeString();
        date.textContent = now.toLocaleDateString(undefined, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    };
    tick();
    const id = setInterval(tick, 1000);

    return { title: 'Clock', el, dispose: () => clearInterval(id) };
}

export function welcomeApp() {
    const el = document.createElement('div');
    el.className = 'app-welcome';
    el.innerHTML = `
        <h2>Welcome 👋</h2>
        <p>You're looking at the <b>back</b> side of this window.</p>
        <p>The front runs a different app entirely — flip it back to check.</p>
    `;
    return { title: 'Welcome', el };
}

// Default back face for windows launched from the Start menu (single app).
export function systemPanel(appName) {
    const el = document.createElement('div');
    el.className = 'app-syspanel';
    el.innerHTML = `<div class="syspanel-logo"><span class="win-logo"><i></i><i></i><i></i><i></i></span></div>`;

    const h = document.createElement('h2');
    h.textContent = appName;
    const p1 = document.createElement('p');
    p1.textContent = 'Back side of this window.';
    const p2 = document.createElement('p');
    p2.className = 'muted';
    p2.textContent = 'Drag the title bar to move · grab a corner to flip';
    el.append(h, p1, p2);

    return { title: `${appName} · back`, el };
}

// Apps offered in the Start menu. `make` builds a fresh instance per launch.
export const APP_REGISTRY = [
    { name: 'Notepad', icon: '📝', make: notepadApp },
    { name: 'Clock', icon: '🕐', make: clockApp },
    { name: 'About 3D-OS', icon: 'ℹ️', make: aboutApp },
    { name: 'Welcome', icon: '👋', make: welcomeApp }
];
