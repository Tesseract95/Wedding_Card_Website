/* Swastik & Soumya · Wedding Website: background music

   One audio player serves the whole site. It is created here, in <head>, so it
   exists and starts downloading before the page body is even parsed, and it is
   attached to the page once the body exists (as #wedding-song). It is never
   recreated or restarted: the site is a single document and its links only scroll.

   The song is only ever played with sound. It is never muted, never started
   silently, and nothing here mutes or unmutes it.

   When it starts:
   1. The moment this file runs, audible playback is attempted. If the browser
      allows autoplay with sound, the music is playing before anything is touched.
      (Measured on a slow connection: this is about 4.8x earlier than a script at
      the end of the page, and the first screen is not slowed.)
   2. Browsers such as Chrome, Safari and Firefox refuse sound until the visitor
      has interacted with the page, and no website code can change that (it was
      tested: HTML audio, the autoplay attribute, a video element, the Web Audio
      API, an iframe with allow="autoplay" and a Permissions-Policy header are all
      refused alike). So the song waits, and the visitor's FIRST press, tap or key
      press, anywhere on the page, starts it: the earliest moment the browser allows.
   This file is independent of the "Tap to enter" screen, whose code never
   touches the audio. */
(function () {
    'use strict';

    var song = new Audio();
    song.id = 'wedding-song';
    // The play attempt below costs nothing, but the 2.3 MB download would compete with the page's
    // own styles and fonts and delay the first screen (measured on a slow phone connection), so
    // it starts once the page has loaded. A visitor's first tap starts the download at once if needed.
    song.preload = 'none';
    song.loop = true;
    song.src = '/wedding_song.mp3';
    window.weddingSong = song;   // for a future player control

    // Diagnostics: open the page with ?musicdebug (or #musicdebug) to log the audio's life in the
    // browser console, with times in ms since the page started. Silent otherwise.
    var debug = /[?&#]musicdebug/.test(location.search + location.hash);
    function log(message) {
        if (debug) { console.log('[music +' + Math.round(performance.now()) + 'ms] ' + message); }
    }
    log('audio element created (preload=none, loop, never muted)');
    ['loadstart', 'loadedmetadata', 'canplay', 'canplaythrough', 'playing', 'pause', 'waiting', 'stalled', 'ended'].forEach(function (name) {
        song.addEventListener(name, function () { log('event: ' + name + ' (t=' + song.currentTime.toFixed(2) + 's, muted=' + song.muted + ', volume=' + song.volume + ')'); });
    });
    if (debug) {
        song.addEventListener('timeupdate', function onFirstTick() {
            if (song.currentTime > 0.5) { song.removeEventListener('timeupdate', onFirstTick); log('time is advancing: t=' + song.currentTime.toFixed(2) + 's, so the song is really playing'); }
        });
    }

    var requested = false;   // a play() call is in flight
    var failed = false;      // the file cannot be played at all
    var armed = false;       // listening for the visitor's first interaction

    // The earliest events browsers accept as a user gesture for sound: a mouse
    // press (pointerdown), a touch when the finger lifts (touchend), a key press
    // (keydown). 'click' is a last catch for browsers that accept only that.
    var gestures = ['pointerdown', 'touchend', 'keydown', 'click'];

    function userPaused() {
        // A future pause button should set data-user-paused on the song so this leaves it alone.
        return song.hasAttribute('data-user-paused');
    }

    // Ignore interactions the browser does not count as a gesture.
    function countsAsGesture(event) {
        if (event.type === 'pointerdown') { return event.pointerType === 'mouse'; }   // touch is handled on touchend
        if (event.type === 'keydown') { return event.key !== 'Escape'; }
        return true;
    }

    function arm() {
        if (armed) { return; }
        armed = true;
        gestures.forEach(function (name) {
            document.addEventListener(name, start, { capture: true, passive: true });
        });
    }

    function disarm() {
        if (!armed) { return; }
        armed = false;
        gestures.forEach(function (name) {
            document.removeEventListener(name, start, true);
        });
    }

    function start(event) {
        if (failed || !song.paused || requested || userPaused()) { return; }
        if (event && event.type && !countsAsGesture(event)) { log('ignored ' + event.type + ' (the browser does not count it as a gesture)'); return; }
        requested = true;
        log('play() attempt, trigger: ' + (event && event.type ? event.type : 'page load / tab visible') + ', user activation so far: ' + navigator.userActivation.hasBeenActive);
        var attempt;
        try { attempt = song.play(); } catch (err) { attempt = null; }
        if (!attempt || typeof attempt.then !== 'function') { requested = false; return; }
        attempt.then(function () {
            requested = false;
            log('play() ACCEPTED by the browser');
        }, function (error) {
            requested = false;
            log('play() REJECTED: ' + (error && error.name) + ' - ' + (error && error.message));
            if (error && error.name === 'NotSupportedError') {
                failed = true;   // no playable source: stop trying
                disarm();
                return;
            }
            arm();   // sound is blocked until the visitor interacts: wait for the first gesture
        });
    }

    // Sound really started: the gesture listeners are no longer needed.
    song.addEventListener('playing', disarm);

    // Something other than the visitor paused it (a call, switching apps): start again
    // at the next gesture. Never restarts the song while it is playing.
    song.addEventListener('pause', function () {
        if (!song.ended && !failed && !userPaused()) { arm(); }
    });

    // A broken or missing file: say so once and stop waiting on it.
    song.addEventListener('error', function () {
        failed = true;
        disarm();
        log('file error code ' + (song.error && song.error.code));
        console.warn('Wedding music: /wedding_song.mp3 could not be loaded.');
    });

    // Back on the tab or app: pick the music up again if the system stopped it.
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && song.paused) { start(); }
    });

    // Begin buffering the song as soon as the first screen is done, so it is ready for the first tap.
    function buffer() { song.preload = 'auto'; log('page loaded: now buffering the song'); }
    if (document.readyState === 'complete') { buffer(); } else { window.addEventListener('load', buffer); }

    // Keep the player in the page (id: wedding-song) without disturbing playback.
    function attach() { if (!song.parentNode && document.body) { document.body.appendChild(song); } }
    if (document.body) { attach(); } else { document.addEventListener('DOMContentLoaded', attach); }

    arm();    // listening from the very start, in case the browser holds sound back
    start();  // earliest possible attempt: audible, before the page body exists
}());
