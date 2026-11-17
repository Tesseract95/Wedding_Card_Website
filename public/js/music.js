/* Swastik & Soumya · Wedding Website: background music

   ONE player for the whole site: one AudioContext, one decoded copy of the track, never recreated or
   restarted by anything on the page (the site is a single document; its links only scroll).

   START
   - Nothing is played, muted or otherwise, before the visitor taps "Tap to enter". This file only
     downloads and decodes the track while the intro is showing, so it is ready.
   - The tap on the intro (a mouse press, a finger tap, or Enter / Space) starts the music, inside that
     gesture, so every browser allows it. It rises from silence over FADE_IN seconds. That is the only
     time it fades in on its own.
   - If the intro is dismissed with Esc (which browsers do not count as a gesture) the music stays off.

   SEAMLESS LOOP
   The recording (190.5 s) holds full level until 188.0 s, stops abruptly, and starts again at full level,
   so a plain restart would leave a dip and a jump. Instead each pass is cut at LOOP_END (187.8 s, before the
   abrupt stop) and the next pass is blended in over the last CROSSFADE seconds with equal-power curves, so the
   loudness stays level and there is no silence, click or fade. The two values were chosen by measuring the
   track: at this point the harmony of the ending matches the harmony of the opening best.
   Every pass is scheduled on the audio clock (sample-accurate, unaffected by scrolling or timers), all passes
   share the same decoded buffer (no second copy in memory), and finished passes are released.

   TRANSPORT (everything is smoothed, nothing jumps)
   - pause():  fades down over PAUSE_FADE, then stops the audio clock; the position is kept.
   - play():   resumes from that position and fades up over RESUME_FADE.
   - mute() / unmute(): fades the level while the music keeps playing underneath.
   - While the page is hidden (another tab or app) or being left, the music is silenced and the audio clock
     is suspended, and it comes back when the visitor returns, unless they had paused it.

   CONTROL: window.weddingMusic = { play(), pause(), toggle(), mute(), unmute(), toggleMute(),
   playing, muted, started }. A 'weddingmusicchange' event fires on document with detail
   { playing, muted } whenever either changes. (This site has no on-screen button yet; this is what one
   would call.)

   ERRORS: if the track cannot be fetched or decoded, a plain looping <audio> element plays it instead
   (same transport; the loop then restarts with the recording's own short gap). If that fails too, one
   warning is logged and the site carries on silently.

   Diagnostics: open the page with ?musicdebug to log the life of the music in the console, and add
   &musicloop=20 to make the loop point come after 20 s so it can be heard quickly (debug only). */
(function () {
    'use strict';

    var SRC = '/audio/wedding-mashup.mp3';
    var VOLUME = 1;            // the level the music settles at (unchanged setting: full level of the recording)
    var LOOP_END = 187.8;      // seconds into the track where each pass is cut (before its abrupt stop at ~188.1 s)
    var CROSSFADE = 3.5;       // seconds the next pass is blended in over the end of the last
    var FADE_IN = 1.8;         // first start, after "Tap to enter"
    var PAUSE_FADE = 0.6;      // explicit pause
    var RESUME_FADE = 0.8;     // explicit resume
    var MUTE_FADE = 0.4;       // mute / unmute
    var HIDE_FADE = 0.2;       // tab hidden or page left
    var SHOW_FADE = 0.4;       // tab visible again

    var debug = /[?&#]musicdebug/.test(location.search + location.hash);
    function log(message) { if (debug) { console.log('[music +' + Math.round(performance.now()) + 'ms] ' + message); } }
    if (debug) {   // shorten the loop to hear the seam quickly: ?musicdebug&musicloop=20
        var m = /[?&]musicloop=(\d+(?:\.\d+)?)/.exec(location.search);
        if (m && +m[1] >= 8) { LOOP_END = +m[1]; CROSSFADE = Math.min(CROSSFADE, LOOP_END / 4); log('DEBUG: loop shortened to ' + LOOP_END + 's'); }
    }
    var PERIOD = LOOP_END - CROSSFADE;   // time between the starts of two passes

    var Ctor = window.AudioContext || window.webkitAudioContext;
    var OfflineCtor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var mode = Ctor && OfflineCtor ? 'webaudio' : 'element';   // 'element' = plain looping <audio> (only if Web Audio is missing or the track cannot be decoded)

    var ctx = null, bus = null, muteGain = null, master = null;
    var buffer = null, loading = false;
    var el = null, elRaf = 0, elSuspend = 0;               // the <audio> fallback
    var started = false;       // the visitor has tapped "Tap to enter": the music has been asked for
    var running = false;       // the passes are scheduled (Web Audio) / the element is playing
    var userPaused = false, muted = false, hidden = document.hidden;
    var failed = false;
    var count = 0, nextStart = 0, timer = 0, suspendTimer = 0;
    var lastPlaying = false, lastMuted = false;

    function isPlaying() { return started && !userPaused && !failed; }
    function emit() {
        var p = isPlaying();
        if (p === lastPlaying && muted === lastMuted) { return; }
        lastPlaying = p; lastMuted = muted;
        log((p ? 'PLAYING' : 'paused') + (muted ? ' (muted)' : ''));
        try { document.dispatchEvent(new CustomEvent('weddingmusicchange', { detail: { playing: p, muted: muted } })); } catch (err) { /* old browser */ }
    }

    // ---------- smooth level changes ----------
    var CURVE_N = 96;
    function curve(from, to) {
        var c = new Float32Array(CURVE_N);
        for (var k = 0; k < CURVE_N; k++) { var t = k / (CURVE_N - 1); c[k] = from + (to - from) * (t * t * (3 - 2 * t)); }   // smoothstep: no corner at either end
        return c;
    }
    function glide(param, to, seconds, fromZero) {
        var now = ctx.currentTime, from = fromZero ? 0 : param.value;
        param.cancelScheduledValues(now);
        if (seconds <= 0 || from === to) { param.setValueAtTime(to, now); return; }
        param.setValueAtTime(from, now);
        param.setValueCurveAtTime(curve(from, to), now, seconds);
    }

    // ---------- the track: fetched and decoded once, while the intro is showing ----------
    function decode(raw) {
        return new Promise(function (resolve, reject) {
            var offline = new OfflineCtor(2, 1, 44100);   // decoding needs no sound output, so no autoplay permission
            var p = offline.decodeAudioData(raw, resolve, reject);   // old Safari uses the callbacks, modern browsers the promise
            if (p && p.then) { p.then(resolve, reject); }
        });
    }
    function load() {
        if (loading || buffer || failed || mode !== 'webaudio') { return; }
        loading = true;
        log('fetching ' + SRC);
        fetch(SRC).then(function (r) {
            if (!r.ok) { throw new Error('HTTP ' + r.status); }
            return r.arrayBuffer();
        }).then(decode).then(function (decoded) {
            buffer = decoded;
            log('decoded: ' + buffer.duration.toFixed(2) + 's, ' + buffer.sampleRate + ' Hz, ready');
            if (LOOP_END > buffer.duration - 0.2) { LOOP_END = buffer.duration - 0.2; PERIOD = LOOP_END - CROSSFADE; }
            if (started) { begin(); }
        }).catch(function (error) {
            log('Web Audio could not load the track (' + (error && (error.message || error.name)) + '): using a plain audio element');
            useElement();
        });
    }

    // ---------- Web Audio engine ----------
    var N = 128;
    var FADE_IN_CURVE = new Float32Array(N), FADE_OUT_CURVE = new Float32Array(N);
    for (var i = 0; i < N; i++) { FADE_IN_CURVE[i] = Math.sin(Math.PI / 2 * i / (N - 1)); FADE_OUT_CURVE[i] = Math.cos(Math.PI / 2 * i / (N - 1)); }   // equal power: the sum keeps the loudness level

    function makeContext() {
        var c;
        try { c = new Ctor({ sampleRate: buffer ? buffer.sampleRate : 44100 }); } catch (err) { c = new Ctor(); }   // same rate as the track: no resampling
        ctx = c;
        bus = ctx.createGain();
        muteGain = ctx.createGain(); muteGain.gain.value = muted ? 0 : 1;
        master = ctx.createGain(); master.gain.value = 0;                       // silent until the fade-in begins
        bus.connect(muteGain); muteGain.connect(master); master.connect(ctx.destination);
        ctx.addEventListener('statechange', function () { log('AudioContext ' + ctx.state); });
    }

    // One pass of the track: [at, at+LOOP_END]. The first has no fade-in (the master fades it in); every other fades in
    // over CROSSFADE as the one before it fades out; every pass fades out over its last CROSSFADE seconds.
    function schedulePass(at, first) {
        var src = ctx.createBufferSource();
        src.buffer = buffer;
        var g = ctx.createGain();
        src.connect(g); g.connect(bus);
        if (first) { g.gain.setValueAtTime(1, at); }
        else { g.gain.setValueAtTime(0, at); g.gain.setValueCurveAtTime(FADE_IN_CURVE, at, CROSSFADE); }
        g.gain.setValueCurveAtTime(FADE_OUT_CURVE, at + LOOP_END - CROSSFADE, CROSSFADE);
        src.start(at);
        src.stop(at + LOOP_END + 0.05);
        src.onended = function () { try { src.disconnect(); g.disconnect(); } catch (err) { /* already gone */ } };
        log('pass ' + count + ' scheduled at audio time ' + at.toFixed(2) + 's');
    }
    function fill() {   // keep the next pass scheduled well ahead; one buffer, so it costs nothing
        if (!ctx || !buffer) { return; }
        while (nextStart < ctx.currentTime + PERIOD + 30) { schedulePass(nextStart, count === 0); count++; nextStart += PERIOD; }
    }

    // The first start: begins the track and rises from silence. Called when the tap has happened AND the track is decoded.
    function begin() {
        if (running || failed || !ctx || !buffer || userPaused) { return; }
        if (hidden) { return; }   // it will begin when the tab is visible again
        running = true;
        nextStart = ctx.currentTime + 0.05; count = 0;
        fill();
        timer = window.setInterval(fill, 4000);
        glide(master.gain, VOLUME, FADE_IN, true);
        log('started: fading in over ' + FADE_IN + 's, loop ' + LOOP_END + 's with a ' + CROSSFADE + 's crossfade');
        emit();
    }

    // Bring the audio clock and the level in line with what is wanted (visitor's pause, tab hidden). Safe to call any time.
    function transport(fade) {
        if (mode === 'element') { elementTransport(fade); return; }
        if (!ctx || !running) { return; }
        window.clearTimeout(suspendTimer);
        var want = !userPaused && !hidden;
        if (want) {
            var go = function () { glide(master.gain, VOLUME, fade); };
            if (ctx.state === 'running') { go(); } else { var p = ctx.resume(); if (p && p.then) { p.then(go, function () { /* blocked */ }); } else { go(); } }
        } else {
            glide(master.gain, 0, fade);
            suspendTimer = window.setTimeout(function () { if (userPaused || hidden) { try { ctx.suspend(); } catch (err) { /* ignore */ } } }, fade * 1000 + 60);
        }
    }

    // ---------- plain <audio> fallback ----------
    function elFade(to, seconds, done) {
        window.cancelAnimationFrame(elRaf);
        var from = el.volume, t0 = performance.now();
        function step(now) {
            var p = Math.min(1, (now - t0) / Math.max(1, seconds * 1000)), s = p * p * (3 - 2 * p);
            try { el.volume = from + (to - from) * s; } catch (err) { /* iOS keeps the volume fixed */ }
            if (p < 1) { elRaf = window.requestAnimationFrame(step); } else if (done) { done(); }
        }
        elRaf = window.requestAnimationFrame(step);
    }
    function useElement() {
        if (mode === 'element' && el) { return; }
        mode = 'element';
        if (ctx) { try { ctx.close(); } catch (err) { /* ignore */ } ctx = null; }
        window.clearInterval(timer); running = false;
        el = new Audio();
        el.loop = true; el.preload = 'auto'; el.src = SRC; el.muted = muted;
        try { el.volume = 0; } catch (err) { /* ignore */ }
        el.addEventListener('error', function () { fail(); });
        if (started) { elementStart(); }
    }
    function elementStart() {
        if (running || failed || userPaused || hidden) { return; }
        var attempt; try { attempt = el.play(); } catch (err) { attempt = null; }
        running = true;
        if (attempt && attempt.catch) { attempt.catch(function () { running = false; log('audio element play() was refused'); }); }
        elFade(VOLUME, FADE_IN);
        log('started with a plain audio element, fading in over ' + FADE_IN + 's');
        emit();
    }
    function elementTransport(fade) {
        if (!el || !running) { return; }
        window.clearTimeout(elSuspend);
        if (!userPaused && !hidden) { var a; try { a = el.play(); } catch (err) { a = null; } if (a && a.catch) { a.catch(function () { /* blocked */ }); } elFade(VOLUME, fade); }
        else { elFade(0, fade, function () { if (userPaused || hidden) { el.pause(); } }); }
    }

    function fail() {
        if (failed) { return; }
        failed = true;
        window.clearInterval(timer);
        console.warn('Wedding music: ' + SRC + ' could not be loaded.');
        emit();
    }

    // ---------- the visitor's tap on "Tap to enter" ----------
    function introShowing() {
        var intro = document.getElementById('intro');
        return !!intro && document.documentElement.classList.contains('has-intro') && !intro.classList.contains('is-done');
    }
    function onIntro(target) { return !!(target && target.closest && target.closest('#intro')); }

    var touchX = 0, touchY = 0, touchMoved = false;
    var gestureEvents = ['pointerdown', 'touchstart', 'touchmove', 'touchend', 'keydown', 'click'];
    function onGesture(event) {
        var type = event.type;
        if (type === 'touchstart') { var a = event.touches && event.touches[0]; touchMoved = false; touchX = a ? a.clientX : 0; touchY = a ? a.clientY : 0; return; }
        if (type === 'touchmove') { var b = event.touches && event.touches[0]; if (b && (Math.abs(b.clientX - touchX) > 10 || Math.abs(b.clientY - touchY) > 10)) { touchMoved = true; } return; }
        if (type === 'pointerdown') { if (event.pointerType !== 'mouse' || !onIntro(event.target)) { return; } }
        else if (type === 'touchend') { if (touchMoved || !onIntro(event.target)) { return; } }
        else if (type === 'click') { if (!onIntro(event.target)) { return; } }
        else if (type === 'keydown') { if ((event.key !== 'Enter' && event.key !== ' ') || !introShowing()) { return; } }   // Esc is not a gesture
        log('"Tap to enter" via ' + type + ' (user activation: ' + navigator.userActivation.hasBeenActive + ')');
        startNow();
    }
    function disarm() { gestureEvents.forEach(function (name) { document.removeEventListener(name, onGesture, true); }); }
    gestureEvents.forEach(function (name) { document.addEventListener(name, onGesture, { capture: true, passive: true }); });

    function startNow() {
        if (started || failed) { return; }
        started = true; userPaused = false;
        disarm();
        if (mode === 'webaudio') {
            makeContext();                                    // created and resumed inside the tap, so the browser allows it
            var p = ctx.resume(); if (p && p.catch) { p.catch(function () { /* the next transport call retries */ }); }
            if (buffer) { begin(); } else { load(); }
        } else if (el) { elementStart(); } else { useElement(); }   // useElement() starts it, because the tap has happened
        emit();
    }

    // ---------- leaving / hiding the page ----------
    function setHidden(value) {
        if (hidden === value) { return; }
        hidden = value;
        log('page ' + (hidden ? 'hidden: silencing' : 'visible again'));
        if (!started) { return; }
        if (!running) { if (!hidden) { if (mode === 'webaudio') { begin(); } else { elementStart(); } } return; }
        transport(hidden ? HIDE_FADE : SHOW_FADE);
    }
    document.addEventListener('visibilitychange', function () { setHidden(document.hidden); });
    window.addEventListener('pagehide', function () { log('page left: silencing'); hidden = true; if (ctx && running && mode === 'webaudio') { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.value = 0; try { ctx.suspend(); } catch (err) { /* ignore */ } } else if (el) { el.pause(); } });
    window.addEventListener('pageshow', function (event) { if (event.persisted) { hidden = true; setHidden(false); } });

    // ---------- the visitor's explicit controls (for a future speaker button) ----------
    function pause() {
        if (!started || userPaused || failed) { return; }
        userPaused = true;
        transport(PAUSE_FADE);
        emit();
    }
    function play() {   // call from a click: that click is the gesture the browser needs
        if (!started) { startNow(); return; }
        if (!userPaused) { return; }
        userPaused = false;
        if (!running) { if (mode === 'webaudio') { begin(); } else { elementStart(); } } else { transport(RESUME_FADE); }
        emit();
    }
    function setMuted(value) {
        if (muted === value) { return; }
        muted = value;
        if (mode === 'webaudio' && muteGain) { glide(muteGain.gain, muted ? 0 : 1, MUTE_FADE); }
        else if (el) { if (muted) { elFade(0, MUTE_FADE, function () { el.muted = true; }); } else { el.muted = false; elFade(VOLUME, MUTE_FADE); } }
        emit();
    }

    window.weddingMusic = {
        play: play,
        pause: pause,
        toggle: function () { if (isPlaying()) { pause(); } else { play(); } },
        mute: function () { setMuted(true); },
        unmute: function () { setMuted(false); },
        toggleMute: function () { setMuted(!muted); },
        get playing() { return isPlaying(); },
        get muted() { return muted; },
        get started() { return started; },
        get output() { return master; }   // the last node before the speakers (used by tests to measure real sound)
    };

    // ---------- get the track ready while the intro is showing ----------
    function prepare() { if (mode === 'webaudio') { load(); } else { useElement(); } }
    if (document.readyState === 'complete') { prepare(); } else { window.addEventListener('load', prepare); }   // after the first screen, so it never competes with it
}());
