(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SETTINGS_KEY = 'flipclock.settings';
  const TIMER_KEY = 'flipclock.timer';

  const DEFAULTS = {
    theme: 'auto', h24: false, seconds: false, showDate: true, wake: true, flipAnim: true,
    focus: 25, short: 5, long: 15, every: 4, autoStart: false, chime: true,
    mode: 'clock', intention: ''
  };

  const S = Object.assign({}, DEFAULTS, read(SETTINGS_KEY));
  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  };
  const T = Object.assign({
    phase: 'focus', done: 0, running: false, endAt: 0,
    remaining: S.focus * 60000, statsDate: today(), statsMin: 0
  }, read(TIMER_KEY));

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch (e) {} }
  function saveTimer() { try { localStorage.setItem(TIMER_KEY, JSON.stringify(T)); } catch (e) {} }

  const app = $('app');
  const flips = [$('f-a'), $('f-b'), $('f-c')];
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- Flip cards ---------- */

  flips.forEach((el, i) => {
    el.innerHTML =
      '<div class="half top"><span></span></div>' +
      '<div class="half bottom"><span></span></div>' +
      '<div class="half top leaf leaf-top"><span></span></div>' +
      '<div class="half bottom leaf leaf-bottom"><span></span></div>' +
      (i === 0 ? '<span class="ampm" id="ampm"></span>' : '');
    el._s = el.querySelectorAll('.half span');
  });

  function setCard(el, value, animate) {
    if (el.dataset.v === value) return;
    const old = el.dataset.v;
    el.dataset.v = value;
    const [top, bottom, leafTop, leafBottom] = el._s;

    // The flip is the point of the app, so it runs even when the OS asks for less motion.
    // It can be turned off in Settings → Flip animation.
    if (old === undefined || !animate || !S.flipAnim || document.hidden) {
      top.textContent = bottom.textContent = leafTop.textContent = leafBottom.textContent = value;
      el.classList.remove('flipping');
      return;
    }
    top.textContent = value;        // revealed behind the falling leaf
    bottom.textContent = old;       // stays until the new half lands
    leafTop.textContent = old;
    leafBottom.textContent = value;
    el.classList.remove('flipping');
    void el.offsetWidth;            // restart the animation
    el.classList.add('flipping');
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      bottom.textContent = value;
      el.classList.remove('flipping');
    }, 720);
  }

  /* ---------- Clock ---------- */

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  }
  function dayOfYear(d) {
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1;
  }

  function renderClock(animate) {
    const d = new Date();
    let h = d.getHours();
    const hStr = S.h24 ? pad(h) : String(h % 12 || 12);
    setCard(flips[0], hStr, animate);
    setCard(flips[1], pad(d.getMinutes()), animate);
    if (S.seconds) setCard(flips[2], pad(d.getSeconds()), animate);

    const ampm = $('ampm');
    ampm.textContent = S.h24 ? '' : (h >= 12 ? 'PM' : 'AM');

    $('date').textContent = S.showDate
      ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
      : '';
    const leap = new Date(d.getFullYear(), 1, 29).getMonth() === 1;
    $('clock-foot').textContent = S.showDate
      ? 'Week ' + isoWeek(d) + ' · Day ' + dayOfYear(d) + ' of ' + (leap ? 366 : 365)
      : '';
  }

  /* ---------- Focus timer ---------- */

  const PHASE_NAMES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  const phaseLength = (p) => (p === 'focus' ? S.focus : p === 'short' ? S.short : S.long) * 60000;

  function remainingMs() {
    return T.running ? Math.max(0, T.endAt - Date.now()) : T.remaining;
  }

  function rollStats() {
    if (T.statsDate !== today()) { T.statsDate = today(); T.statsMin = 0; }
  }

  function renderFocus(animate) {
    const ms = remainingMs();
    const total = Math.ceil(ms / 1000);
    setCard(flips[0], pad(Math.floor(total / 60)), animate);
    setCard(flips[1], pad(total % 60), animate);
    $('ampm').textContent = '';

    const len = phaseLength(T.phase);
    $('progress-fill').style.transform = 'scaleX(' + Math.min(1, Math.max(0, 1 - ms / len)) + ')';

    const label = PHASE_NAMES[T.phase];
    const phaseEl = $('phase');
    phaseEl.textContent = '';
    const b = document.createElement('b');
    b.textContent = label;
    phaseEl.appendChild(b);
    if (T.phase === 'focus' && S.intention) phaseEl.appendChild(document.createTextNode(' · ' + S.intention));

    const fresh = !T.running && T.remaining >= len;
    $('btn-start').textContent = T.running ? 'Pause' : fresh ? 'Start' : 'Resume';

    const dots = $('dots');
    const inRound = T.phase === 'long' && T.done > 0 && T.done % S.every === 0 ? S.every : T.done % S.every;
    if (dots.childElementCount !== S.every || dots.dataset.on !== String(inRound)) {
      dots.innerHTML = '';
      for (let i = 0; i < S.every; i++) {
        const dot = document.createElement('i');
        if (i < inRound) dot.className = 'on';
        dots.appendChild(dot);
      }
      dots.dataset.on = String(inRound);
      dots.setAttribute('aria-label', inRound + ' of ' + S.every + ' sessions done this round');
    }

    rollStats();
    $('today').textContent = T.statsMin + ' min focused today';

    document.title = T.running ? pad(Math.floor(total / 60)) + ':' + pad(total % 60) + ' · ' + label : 'Flip Clock';

    document.querySelectorAll('#presets .chip[data-focus]').forEach((c) => {
      c.classList.toggle('active', +c.dataset.focus === S.focus && +c.dataset.short === S.short);
    });
  }

  function start() {
    unlockAudio();
    askNotify();
    T.running = true;
    T.endAt = Date.now() + T.remaining;
    saveTimer();
    updateWake();
    render(false);
  }
  function pause() {
    T.remaining = remainingMs();
    T.running = false;
    saveTimer();
    updateWake();
    render(false);
  }
  function reset() {
    T.running = false;
    T.remaining = phaseLength(T.phase);
    saveTimer();
    updateWake();
    render(true);
  }
  function goTo(phase, autoRun) {
    T.phase = phase;
    T.remaining = phaseLength(phase);
    T.running = !!autoRun;
    if (T.running) T.endAt = Date.now() + T.remaining;
    saveTimer();
    updateWake();
    render(true);
  }
  function skip() {
    goTo(T.phase === 'focus' ? 'short' : 'focus', T.running);
  }

  function complete(silent) {
    let next, message;
    if (T.phase === 'focus') {
      rollStats();
      T.statsMin += S.focus;
      T.done += 1;
      next = T.done % S.every === 0 ? 'long' : 'short';
      message = 'Focus done. Take a ' + (next === 'long' ? S.long : S.short) + '-minute break.';
    } else {
      next = 'focus';
      message = 'Break over. Ready for the next session.';
    }
    if (!silent) {
      chime();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      notify(message);
      toast(message);
    }
    goTo(next, S.autoStart);
  }

  /* ---------- Render loop ---------- */

  function render(animate) {
    if (S.mode === 'focus') renderFocus(animate);
    else { renderClock(animate); document.title = 'Flip Clock'; }
  }

  function tick() {
    if (S.mode === 'focus' || T.running) {
      if (T.running && T.endAt - Date.now() <= 0) complete(false);
    }
    render(true);
    setTimeout(tick, 1000 - (Date.now() % 1000) + 8);
  }

  /* ---------- Mode, theme, layout ---------- */

  function applyMode() {
    const focus = S.mode === 'focus';
    $('tab-clock').setAttribute('aria-selected', String(!focus));
    $('tab-focus').setAttribute('aria-selected', String(focus));
    $('focus-panel').hidden = !focus;
    $('progress').hidden = !focus;
    $('phase').hidden = !focus;
    $('clock-foot').hidden = focus;
    $('date').style.visibility = focus ? 'hidden' : '';
    const showSec = !focus && S.seconds;
    flips[2].hidden = !showSec;
    $('clock').classList.toggle('with-sec', showSec);
    $('intention').value = S.intention;
  }

  function setMode(mode) {
    if (S.mode === mode) return;
    S.mode = mode;
    saveSettings();
    applyMode();
    render(true);
    nudge();
  }

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const root = document.documentElement;
    if (S.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', S.theme);
    const btn = $('btn-theme');
    btn.dataset.theme = S.theme;
    btn.setAttribute('aria-label', 'Theme: ' + S.theme[0].toUpperCase() + S.theme.slice(1));
    const dark = S.theme === 'dark' || (S.theme === 'auto' && darkQuery.matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', dark ? '#0A0A0B' : '#E9E7E2');
    });
  }
  darkQuery.addEventListener('change', applyTheme);

  function cycleTheme() {
    S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme];
    saveSettings();
    applyTheme();
    syncSettingsForm();
    toast('Theme: ' + S.theme[0].toUpperCase() + S.theme.slice(1));
  }

  /* ---------- Idle: hide controls ---------- */

  let idleTimer;
  function nudge() {
    app.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const typing = document.activeElement === $('intention');
      const pausedFocus = S.mode === 'focus' && !T.running;
      if (!$('settings').open && !typing && !pausedFocus) app.classList.add('idle');
    }, 4000);
  }
  ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, nudge, { passive: true }));

  /* ---------- Screen wake lock ---------- */

  let wakeLock = null;
  async function updateWake() {
    const want = (S.wake || T.running) && document.visibilityState === 'visible';
    try {
      if (want && !wakeLock && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!want && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    updateWake();
    if (!document.hidden) render(false);
  });

  /* ---------- Sound & notifications ---------- */

  let audio = null;
  function unlockAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }
  function chime() {
    if (!S.chime || !audio) return;
    const now = audio.currentTime;
    [[659.25, 0], [987.77, .18], [1318.5, .36]].forEach(([freq, delay]) => {
      [1, 2.01].forEach((mult, k) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        const t0 = now + delay;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(k ? 0.04 : 0.18, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
        osc.connect(gain).connect(audio.destination);
        osc.start(t0);
        osc.stop(t0 + 1.9);
      });
    });
  }
  function askNotify() {
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (e) {}
  }
  function notify(text) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => reg.showNotification('Flip Clock', { body: text, icon: 'icons/icon-192.png' }));
      } else {
        new Notification('Flip Clock', { body: text, icon: 'icons/icon-192.png' });
      }
    } catch (e) {}
  }

  let toastTimer;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------- Fullscreen ---------- */

  function toggleFullscreen() {
    if (!document.fullscreenEnabled) return;
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(() => {});
  }
  if (!document.fullscreenEnabled) $('btn-fullscreen').hidden = true;

  /* ---------- Settings ---------- */

  const dialog = $('settings');
  const bindCheck = { 'set-flip': 'flipAnim', 'set-h24': 'h24', 'set-seconds': 'seconds', 'set-date': 'showDate', 'set-wake': 'wake', 'set-autostart': 'autoStart', 'set-chime': 'chime' };
  const bindNum = { 'set-focus': ['focus', 1, 99], 'set-short': ['short', 1, 60], 'set-long': ['long', 1, 60], 'set-every': ['every', 2, 8] };

  function syncSettingsForm() {
    const radio = $('theme-' + S.theme);
    if (radio) radio.checked = true;
    Object.keys(bindCheck).forEach((id) => { $(id).checked = !!S[bindCheck[id]]; });
    Object.keys(bindNum).forEach((id) => { $(id).value = S[bindNum[id][0]]; });
  }

  function lengthsChanged() {
    // Only refresh an idle, untouched timer so a running session is never cut short.
    if (!T.running) { T.remaining = phaseLength(T.phase); saveTimer(); }
  }

  document.querySelectorAll('input[name="theme"]').forEach((r) =>
    r.addEventListener('change', () => { S.theme = r.value; saveSettings(); applyTheme(); }));

  Object.keys(bindCheck).forEach((id) => {
    $(id).addEventListener('change', (e) => {
      S[bindCheck[id]] = e.target.checked;
      saveSettings();
      if (id === 'set-wake') updateWake();
      applyMode();
      render(false);
    });
  });

  Object.keys(bindNum).forEach((id) => {
    $(id).addEventListener('change', (e) => {
      const [key, min, max] = bindNum[id];
      const v = Math.round(Number(e.target.value));
      S[key] = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : DEFAULTS[key];
      e.target.value = S[key];
      saveSettings();
      lengthsChanged();
      render(false);
    });
  });

  function openSettings(focusId) {
    syncSettingsForm();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (focusId) setTimeout(() => $(focusId).focus(), 50);
  }
  dialog.addEventListener('close', nudge);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  /* ---------- Install ---------- */

  let installEvent = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (standalone) {
    $('install-status').textContent = 'Flip Clock is installed on this device.';
  } else if (isIOS) {
    $('install-status').innerHTML = 'In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    $('btn-install').hidden = false;
    $('btn-install-2').hidden = false;
    $('install-status').textContent = 'Add Flip Clock to this device. It opens in its own window and works offline.';
  });
  async function install() {
    if (!installEvent) { openSettings(); return; }
    installEvent.prompt();
    try { await installEvent.userChoice; } catch (e) {}
    installEvent = null;
    $('btn-install').hidden = true;
    $('btn-install-2').hidden = true;
  }
  window.addEventListener('appinstalled', () => {
    $('btn-install').hidden = true;
    $('btn-install-2').hidden = true;
    $('install-status').textContent = 'Flip Clock is installed on this device.';
    toast('Installed');
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* ---------- Events ---------- */

  $('tab-clock').addEventListener('click', () => setMode('clock'));
  $('tab-focus').addEventListener('click', () => setMode('focus'));
  $('btn-theme').addEventListener('click', cycleTheme);
  $('btn-fullscreen').addEventListener('click', toggleFullscreen);
  $('btn-settings').addEventListener('click', () => openSettings());
  $('btn-install').addEventListener('click', install);
  $('btn-install-2').addEventListener('click', install);
  $('btn-start').addEventListener('click', () => (T.running ? pause() : start()));
  $('btn-reset').addEventListener('click', reset);
  $('btn-skip').addEventListener('click', skip);
  $('btn-custom').addEventListener('click', () => openSettings('set-focus'));

  document.querySelectorAll('#presets .chip[data-focus]').forEach((chip) => {
    chip.addEventListener('click', () => {
      S.focus = +chip.dataset.focus;
      S.short = +chip.dataset.short;
      S.long = S.short * 3;
      saveSettings();
      lengthsChanged();
      render(true);
    });
  });

  $('intention').addEventListener('input', (e) => {
    S.intention = e.target.value.trim();
    saveSettings();
    render(false);
  });
  $('intention').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  // Double-tap the clock to go full screen.
  $('clock').addEventListener('dblclick', toggleFullscreen);

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey || dialog.open) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && S.mode === 'focus') { e.preventDefault(); T.running ? pause() : start(); }
    else if (k === 'm') setMode(S.mode === 'focus' ? 'clock' : 'focus');
    else if (k === 'f') toggleFullscreen();
    else if (k === 't') cycleTheme();
  });

  /* ---------- Boot ---------- */

  // A session that ended while the app was closed is counted, without a chime.
  if (T.running && T.endAt <= Date.now()) complete(true);

  applyTheme();
  applyMode();
  render(false);
  updateWake();
  nudge();
  setTimeout(tick, 1000 - (Date.now() % 1000) + 8);
})();
