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

// Embedded YouTube player. The window face is real DOM (CSS3D), so the player
// is a normal <iframe>; a URL/ID bar lets you load any video. This is the
// template for future embedded apps (browser, maps, …).
export function youtubeApp() {
    const el = document.createElement('div');
    el.className = 'app-youtube';
    el.innerHTML = `
        <div class="yt-bar">
            <input class="yt-input" type="text" placeholder="Paste a YouTube link or video ID…" spellcheck="false">
            <button class="yt-load" type="button">Load</button>
        </div>
        <div class="yt-stage">
            <iframe class="yt-frame"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerpolicy="strict-origin-when-cross-origin"
                allowfullscreen></iframe>
        </div>
    `;

    const input = el.querySelector('.yt-input');
    const frame = el.querySelector('.yt-frame');

    // Pull an 11-char video id out of a full URL or accept a bare id.
    const parseId = (raw) => {
        const text = raw.trim();
        const m = text.match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{11})/);
        if (m) return m[1];
        if (/^[\w-]{11}$/.test(text)) return text;
        return null;
    };

    // Only the /embed/ form is frameable (watch pages send X-Frame-Options).
    const load = (id) => {
        frame.src = `https://www.youtube.com/embed/${id}`;
    };

    const submit = () => {
        const id = parseId(input.value);
        if (id) {
            input.classList.remove('yt-error');
            load(id);
        } else {
            input.classList.add('yt-error');
        }
    };

    el.querySelector('.yt-load').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        input.classList.remove('yt-error');
    });

    // Start on a stable, neutral default — YouTube's first-ever video.
    const DEFAULT_ID = 'jNQXAC9IVRw';
    input.value = DEFAULT_ID;
    load(DEFAULT_ID);

    return { title: 'YouTube', el };
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
    { name: 'YouTube', icon: '📺', make: youtubeApp },
    { name: 'Notepad', icon: '📝', make: notepadApp },
    { name: 'Clock', icon: '🕐', make: clockApp },
    { name: 'About 3D-OS', icon: 'ℹ️', make: aboutApp },
    { name: 'Welcome', icon: '👋', make: welcomeApp }
];
