/* Swastik & Soumya · Wedding Website: background music

   ONE player for the whole site, created in <head> so it exists before the first screen is drawn.
   It is built on the Web Audio API (one AudioContext, one looping buffer source), the same approach
   as the couple's other invitation site. Unlike an <audio> element, Web Audio does not put a media
   notification / lock-screen control on phones, and it can be silenced completely and instantly.

   The song is only ever played with sound. It is never muted, never started silently, and nothing
   here mutes or unmutes it.

   START
   1. The moment this file runs it asks the browser to start the sound. If the visitor arrived by
      clicking a link, or the browser otherwise allows sound, the music plays on the first screen,
      with nothing touched. (The 2.3 MB download starts at once in that case; otherwise it waits for
      the page to finish loading so the first screen is not slowed.)
   2. If the browser blocks sound until the visitor interacts (typed address, reload, bookmark,
      Safari/iOS), the first real press, TAP or key press starts it. Only these count:
        - a mouse press, a finger TAP (finger down and up in place), a key press (not Esc), a click.
      Scrolling, swiping and mouse-wheel never start or restart the music.
   The "Tap to enter" screen has nothing to do with the music.

   STOP
   - While the page is hidden (another tab, another app, screen off) the music is silenced and the
     audio clock is suspended, so nothing keeps playing in the background. It resumes where it was
     when the visitor returns, unless they had paused it.
   - When the page is left or closed (pagehide) it is suspended too; the browser also ends it when
     the document is unloaded.
   - pause() is the visitor's explicit choice: nothing restarts it afterwards except play().

   CONTROL (for a future speaker button): window.weddingMusic = { play(), pause(), toggle(), playing }.
   A 'weddingmusicchange' event fires on document with detail.playing whenever that changes.

   Diagnostics: open the page with ?musicdebug to log the life of the music in the console. */
(function () {
    'use strict';

    var SRC = '/wedding_song.mp3';
    var VOLUME = 1;            // unchanged from the original player (full level of the recording)
    var RAMP_DOWN = 0.2;       // seconds to fade out before pausing (avoids a click)
    var RAMP_UP = 0.25;        // seconds to fade back in after a pause / returning to the tab

    var debug = /[?&#]musicdebug/.test(location.search + location.hash);
    function log(message) {
        if (debug) { console.log('[music +' + Math.round(performance.now()) + 'ms] ' + message); }
    }

    var Ctor = window.AudioContext || window.webkitAudioContext;
    var mode = Ctor ? 'webaudio' : 'element';   // 'element' = plain looping <audio>, only if Web Audio is missing or the file cannot be decoded
    var ctx = null, master = null, buffer = null, source = null;
    var el = null;             // the <audio> fallback (only ever created in 'element' mode)
    var loading = false;       // the file is being fetched / decoded
    var failed = false;        // the file cannot be played at all
    var userOff = false;       // the visitor paused it: nothing may restart it except play()
    var playing = false;       // what the visitor is hearing
    var armed = false;         // waiting for the visitor's first tap / press
    var hideTimer = 0, pauseTimer = 0;

    function setPlaying(value) {
        if (playing === value) { return; }
        playing = value;
        log(value ? 'PLAYING' : 'not playing');
        try { document.dispatchEvent(new CustomEvent('weddingmusicchange', { detail: { playing: value } })); } catch (err) { /* old browser: no event */ }
    }

    function ramp(level, seconds) {
        if (!master) { return; }
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(level, now + seconds);
    }

    // ---------- the file: fetched and decoded once ----------
    function decode(raw) {
        return new Promise(function (resolve, reject) {
            var promise = ctx.decodeAudioData(raw, resolve, reject);   // old Safari uses the callbacks, modern browsers the promise
            if (promise && promise.then) { promise.then(resolve, reject); }
        });
    }

    function load() {
        if (loading || buffer || failed || mode !== 'webaudio') { return; }
        loading = true;
        log('fetching ' + SRC);
        fetch(SRC).then(function (response) {
            if (!response.ok) { throw new Error('HTTP ' + response.status); }
            return response.arrayBuffer();
        }).then(decode).then(function (decoded) {
            buffer = decoded;
            log('decoded: ' + buffer.duration.toFixed(1) + 's, ready');
            sync();
        }).catch(function (error) {
            log('Web Audio could not load the file (' + (error && (error.message || error.name)) + '): using a plain audio element');
            useElement();
        });
    }

    // ---------- Web Audio: start / keep in step ----------
    // Brings the sound in line with what is wanted. Safe to call at any time, never starts a second copy.
    function sync() {
        if (mode === 'element') { elementSync(); return; }
        if (userOff || document.hidden || !buffer || !ctx || ctx.state !== 'running') { return; }
        if (!source) {
            source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(master);
            source.start(0);
            log('source started (single looping source)');
        }
        if (master.gain.value < VOLUME) { ramp(VOLUME, RAMP_UP); }
        setPlaying(true);
    }

    function resume() {
        if (mode !== 'webaudio' || !ctx) { return; }
        try { var promise = ctx.resume(); if (promise && promise.catch) { promise.catch(function () { /* blocked: wait for a tap */ }); } } catch (err) { /* ignore */ }
    }

    // ---------- plain <audio> fallback ----------
    function useElement() {
        if (mode === 'element' && el) { return; }
        mode = 'element';
        if (source) { try { source.stop(); } catch (err) { /* already stopped */ } source = null; }
        el = new Audio();
        el.loop = true;
        el.preload = 'auto';
        el.src = SRC;
        el.addEventListener('playing', function () { setPlaying(true); disarm(); });
        el.addEventListener('pause', function () { setPlaying(false); });
        el.addEventListener('error', function () {
            failed = true;
            disarm();
            console.warn('Wedding music: ' + SRC + ' could not be loaded.');
        });
        elementSync();
    }

    function elementSync() {
        if (!el || failed || userOff || document.hidden || !el.paused) { return; }
        log('audio element: play() attempt');
        var attempt;
        try { attempt = el.play(); } catch (err) { attempt = null; }
        if (attempt && attempt.catch) {
            attempt.catch(function (error) {
                log('audio element play() rejected: ' + (error && error.name));
                if (error && error.name === 'NotSupportedError') { failed = true; disarm(); } else { arm(); }
            });
        }
    }

    // ---------- the visitor's first tap / press ----------
    // Touch is tracked so that a swipe or scroll (finger moves) is never mistaken for a tap.
    var touchX = 0, touchY = 0, touchMoved = false;
    var gestureEvents = ['pointerdown', 'touchstart', 'touchmove', 'touchend', 'keydown', 'click'];

    function onGesture(event) {
        var type = event.type;
        if (type === 'touchstart') {
            var t0 = event.touches && event.touches[0];
            touchMoved = false; touchX = t0 ? t0.clientX : 0; touchY = t0 ? t0.clientY : 0;
            return;
        }
        if (type === 'touchmove') {
            var t1 = event.touches && event.touches[0];
            if (t1 && (Math.abs(t1.clientX - touchX) > 10 || Math.abs(t1.clientY - touchY) > 10)) { touchMoved = true; }
            return;
        }
        if (type === 'touchend' && touchMoved) { log('ignored a swipe/scroll (not a tap)'); return; }
        if (type === 'pointerdown' && event.pointerType !== 'mouse') { return; }   // touch is judged on touchend
        if (type === 'keydown' && event.key === 'Escape') { return; }              // browsers do not count Esc
        if (userOff) { return; }
        log('gesture accepted: ' + type + ' (user activation: ' + navigator.userActivation.hasBeenActive + ')');
        if (mode === 'webaudio') { load(); resume(); sync(); } else { elementSync(); }
    }

    function arm() {
        if (armed) { return; }
        armed = true;
        gestureEvents.forEach(function (name) { document.addEventListener(name, onGesture, { capture: true, passive: true }); });
    }

    function disarm() {
        if (!armed) { return; }
        armed = false;
        gestureEvents.forEach(function (name) { document.removeEventListener(name, onGesture, true); });
    }

    // ---------- leaving / hiding the page ----------
    function silence(immediate) {
        window.clearTimeout(hideTimer);
        if (mode === 'element') { if (el) { el.pause(); } return; }
        if (!ctx || ctx.state !== 'running') { return; }
        if (immediate) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.value = 0; ctx.suspend(); return; }
        ramp(0, RAMP_DOWN);
        hideTimer = window.setTimeout(function () { if (document.hidden || userOff) { ctx.suspend(); } }, RAMP_DOWN * 1000 + 40);
    }

    function wake() {
        window.clearTimeout(hideTimer);
        if (userOff || document.hidden) { return; }
        if (mode === 'element') { elementSync(); return; }
        resume();    // a no-op if it never stopped; otherwise its 'running' state change calls sync()
        sync();
    }

    document.addEventListener('visibilitychange', function () {
        log('page ' + (document.hidden ? 'hidden: silencing' : 'visible again'));
        if (document.hidden) { silence(false); } else { wake(); }
    });
    window.addEventListener('pagehide', function () { log('page left: silencing'); silence(true); });
    window.addEventListener('pageshow', function (event) { if (event.persisted) { wake(); } });

    // ---------- the visitor's explicit choice (for a future speaker button) ----------
    function pause() {
        userOff = true;
        disarm();
        window.clearTimeout(pauseTimer);
        if (mode === 'element') { if (el) { el.pause(); } } else if (ctx && ctx.state === 'running') {
            ramp(0, RAMP_DOWN);
            pauseTimer = window.setTimeout(function () { if (userOff) { ctx.suspend(); } }, RAMP_DOWN * 1000 + 40);
        }
        setPlaying(false);
    }

    function play() {   // call from a click handler: that click is the gesture the browser needs
        userOff = false;
        window.clearTimeout(pauseTimer);
        arm();
        if (mode === 'webaudio') { load(); resume(); sync(); } else { elementSync(); }
    }

    window.weddingMusic = {
        play: play,
        pause: pause,
        toggle: function () { if (playing) { pause(); } else { play(); } },
        get playing() { return playing; },
        get output() { return master; }   // the single output node (used by tests to measure real sound)
    };

    // ---------- start ----------
    if (mode === 'webaudio') {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = VOLUME;
        master.connect(ctx.destination);
        log('AudioContext created: state=' + ctx.state + ' (user activation: ' + navigator.userActivation.hasBeenActive + ')');
        ctx.addEventListener('statechange', function () {
            log('AudioContext state -> ' + ctx.state);
            if (ctx.state === 'running') { disarm(); sync(); }
            else if (!userOff && !document.hidden) { arm(); }   // stopped by the system (call, Safari interruption): wait for the next tap
        });
        if (ctx.state === 'running') {
            load();   // sound is allowed right now: fetch the song at once so it plays on the first screen
        } else {
            arm();    // sound is blocked until the visitor taps / presses
            // meanwhile fetch the song once the page has loaded, so it is ready for that first tap
            if (document.readyState === 'complete') { load(); } else { window.addEventListener('load', load); }
        }
        resume();     // the earliest possible audible attempt
    } else {
        log('no Web Audio: using a plain audio element');
        useElement();
        arm();
    }
}());
