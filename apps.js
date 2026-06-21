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

// 3D Minesweeper. Classic gameplay, but flagged cells raise a real flag that
// sticks out of the board (the window pane runs in `win-3d` / preserve-3d mode,
// so the flag's translateZ protrudes in the actual camera's perspective).
export function minesweeperApp() {
    const COLS = 9;
    const ROWS = 9;
    const MINES = 10;

    const el = document.createElement('div');
    el.className = 'app-minesweeper';
    el.innerHTML = `
        <div class="ms-header">
            <div class="ms-counter">000</div>
            <button class="ms-reset" type="button" title="New game">🙂</button>
            <div class="ms-timer">000</div>
        </div>
        <div class="ms-board"></div>
    `;
    el.style.setProperty('--ms-cols', COLS);

    const boardEl = el.querySelector('.ms-board');
    const counterEl = el.querySelector('.ms-counter');
    const resetEl = el.querySelector('.ms-reset');
    const timerEl = el.querySelector('.ms-timer');

    let cells;          // model: 2D array of { mine, revealed, flagged, count, el }
    let started;        // mines placed yet? (first click is always safe)
    let over;           // game finished?
    let flags;          // number of flags placed
    let revealedCount;  // non-mine reveal progress
    let seconds;
    let timerId = null;

    const pad3 = (n) => String(Math.max(0, Math.min(999, n))).padStart(3, '0');
    const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
    const neighbors = (r, c) => {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if ((dr || dc) && inBounds(r + dr, c + dc)) out.push(cells[r + dr][c + dc]);
            }
        }
        return out;
    };

    const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } };
    const startTimer = () => {
        stopTimer();
        timerId = setInterval(() => {
            seconds++;
            timerEl.textContent = pad3(seconds);
        }, 1000);
    };

    const updateCounter = () => { counterEl.textContent = pad3(MINES - flags); };

    function placeMines(safe) {
        let placed = 0;
        while (placed < MINES) {
            const r = Math.floor(Math.random() * ROWS);
            const c = Math.floor(Math.random() * COLS);
            const cell = cells[r][c];
            if (cell.mine || cell === safe) continue;
            cell.mine = true;
            placed++;
        }
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!cells[r][c].mine) {
                    cells[r][c].count = neighbors(r, c).filter((n) => n.mine).length;
                }
            }
        }
    }

    function setFlag(cell, on) {
        cell.flagged = on;
        cell.el.classList.toggle('flagged', on);
        if (on) {
            const flag = document.createElement('div');
            flag.className = 'ms-flag';
            flag.innerHTML = '<span class="ms-flag-pole"></span><span class="ms-flag-pennant"></span>';
            cell.el.appendChild(flag);
        } else {
            const flag = cell.el.querySelector('.ms-flag');
            if (flag) flag.remove();
        }
    }

    function revealCell(cell) {
        if (cell.revealed || cell.flagged) return;
        cell.revealed = true;
        cell.el.classList.add('revealed');
        revealedCount++;
        if (cell.count > 0) {
            cell.el.textContent = cell.count;
            cell.el.dataset.n = cell.count;
        } else {
            // iterative flood-fill of the blank region
            const stack = neighbors(cell.r, cell.c);
            while (stack.length) {
                const n = stack.pop();
                if (n.revealed || n.flagged || n.mine) continue;
                n.revealed = true;
                n.el.classList.add('revealed');
                revealedCount++;
                if (n.count > 0) {
                    n.el.textContent = n.count;
                    n.el.dataset.n = n.count;
                } else {
                    stack.push(...neighbors(n.r, n.c));
                }
            }
        }
    }

    function endGame(won) {
        over = true;
        stopTimer();
        resetEl.textContent = won ? '😎' : '😵';
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = cells[r][c];
                if (cell.mine) {
                    if (won) { if (!cell.flagged) setFlag(cell, true); }
                    else if (!cell.flagged) { cell.el.classList.add('revealed', 'mine'); cell.el.textContent = '💣'; }
                }
            }
        }
    }

    function onReveal(cell) {
        if (over || cell.flagged || cell.revealed) return;
        if (!started) { placeMines(cell); started = true; startTimer(); }
        if (cell.mine) {
            cell.el.classList.add('revealed', 'mine', 'mine-hit');
            cell.el.textContent = '💣';
            endGame(false);
            return;
        }
        revealCell(cell);
        if (revealedCount === ROWS * COLS - MINES) endGame(true);
    }

    function onFlag(cell) {
        if (over || cell.revealed) return;
        setFlag(cell, !cell.flagged);
        flags += cell.flagged ? 1 : -1;
        updateCounter();
    }

    function build() {
        stopTimer();
        cells = [];
        started = false;
        over = false;
        flags = 0;
        revealedCount = 0;
        seconds = 0;
        timerEl.textContent = pad3(0);
        resetEl.textContent = '🙂';
        boardEl.replaceChildren();
        updateCounter();

        for (let r = 0; r < ROWS; r++) {
            const row = [];
            for (let c = 0; c < COLS; c++) {
                const cellEl = document.createElement('button');
                cellEl.className = 'ms-cell';
                cellEl.type = 'button';
                const cell = { r, c, mine: false, revealed: false, flagged: false, count: 0, el: cellEl };
                cellEl.addEventListener('click', () => onReveal(cell));
                cellEl.addEventListener('contextmenu', (e) => { e.preventDefault(); onFlag(cell); });
                boardEl.appendChild(cellEl);
                row.push(cell);
            }
            cells.push(row);
        }
    }

    boardEl.addEventListener('contextmenu', (e) => e.preventDefault()); // no browser menu over the board
    resetEl.addEventListener('click', build);
    build();

    return { title: 'Minesweeper', el, threeD: true, dispose: stopTimer };
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
    { name: 'Minesweeper', icon: '💣', make: minesweeperApp },
    { name: 'YouTube', icon: '📺', make: youtubeApp },
    { name: 'Notepad', icon: '📝', make: notepadApp },
    { name: 'Clock', icon: '🕐', make: clockApp },
    { name: 'About 3D-OS', icon: 'ℹ️', make: aboutApp },
    { name: 'Welcome', icon: '👋', make: welcomeApp }
];
