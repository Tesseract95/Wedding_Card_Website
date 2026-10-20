/* Swastik & Soumya · Wedding Website
   1. Intro screen that opens the site.
   2. Sticky nav: solid on scroll, highlights the current section.
   3. Sections and cards reveal as the guest scrolls.
   4. Falling marigold petals in the hero.
   5. Live countdown to the wedding.
   6. "Save the Date" downloads a calendar (.ics) file.
   7. A Ganesha photograph replaces the line-art if one has been added.
   8. A golden trail follows the scroll down the celebrations timeline. */

(function () {
    'use strict';

    var html = document.documentElement;
    html.classList.add('js');

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------
       1. Intro
       ------------------------------------------------------------------ */
    var intro = document.getElementById('intro');
    var weddingSong = document.getElementById('wedding-song');

    function finishIntro() {
        html.classList.remove('has-intro');
        if (intro && intro.parentNode) {
            intro.parentNode.removeChild(intro);
        }
        var heading = document.getElementById('couple-names');
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            try { heading.focus({ preventScroll: true }); } catch (err) { heading.focus(); }
        }
    }

    function closeIntro() {
        if (!intro || intro.classList.contains('is-done')) { return; }
        
        // Play the wedding song when intro is closed
        if (weddingSong) {
            weddingSong.play().catch(function(error) {
                console.log('Audio playback failed:', error);
            });
        }
        
        if (reduceMotion) { finishIntro(); return; }
        intro.classList.add('is-done');
        window.setTimeout(finishIntro, 1200);
    }

    if (intro && html.classList.contains('has-intro')) {
        window.scrollTo(0, 0);
        intro.addEventListener('click', closeIntro);
        document.addEventListener('keydown', function onKey(event) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
                closeIntro();
                document.removeEventListener('keydown', onKey);
            }
        });
        // Opens by itself after a few seconds so nobody is left waiting.
        window.setTimeout(closeIntro, 4200);
    } else if (intro) {
        finishIntro();
    }

    /* ------------------------------------------------------------------
       2. Navigation
       ------------------------------------------------------------------ */
    var nav = document.getElementById('nav');
    var navLinks = nav ? Array.prototype.slice.call(nav.querySelectorAll('.nav__links a')) : [];

    function updateNavSolid() {
        if (!nav) { return; }
        nav.classList.toggle('nav--solid', window.scrollY > window.innerHeight * 0.6);
    }
    window.addEventListener('scroll', updateNavSolid, { passive: true });
    updateNavSolid();

    var sections = navLinks.map(function (link) {
        return document.querySelector(link.getAttribute('href'));
    }).filter(Boolean);

    function setActive(id) {
        navLinks.forEach(function (link) {
            link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
    }

    if ('IntersectionObserver' in window && sections.length) {
        var navObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) { setActive(entry.target.id); }
            });
        }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
        sections.forEach(function (section) { navObserver.observe(section); });
    }

    /* ------------------------------------------------------------------
       3. Reveal on scroll
       ------------------------------------------------------------------ */
    var revealables = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window && !reduceMotion) {
        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

        revealables.forEach(function (el) { revealObserver.observe(el); });
    } else {
        revealables.forEach(function (el) { el.classList.add('is-visible'); });
    }

    /* ------------------------------------------------------------------
       4. Marigold petals
       ------------------------------------------------------------------ */
    var petalFields = document.querySelectorAll('.petals');

    if (petalFields.length && !reduceMotion) {
        var colours = ['#FF9933', '#FFB85C', '#FFC857', '#FF7E1F', '#FFD08A'];
        var rand = function (min, max) { return min + Math.random() * (max - min); };
        var small = window.innerWidth < 600;

        Array.prototype.forEach.call(petalFields, function (field) {
            var count = parseInt(field.getAttribute('data-petals'), 10) || 20;
            if (small) { count = Math.ceil(count * 0.6); }

            for (var i = 0; i < count; i++) {
                var petal = document.createElement('span');
                petal.className = 'petal';
                petal.style.left = rand(-2, 100) + '%';
                petal.style.setProperty('--size', rand(12, 26).toFixed(0) + 'px');
                petal.style.setProperty('--dur', rand(10, 20).toFixed(1) + 's');
                petal.style.setProperty('--delay', (-rand(0, 20)).toFixed(1) + 's');
                petal.style.setProperty('--drift', rand(-120, 120).toFixed(0) + 'px');
                petal.style.setProperty('--spin', rand(180, 720).toFixed(0) + 'deg');
                petal.style.setProperty('--sway', rand(2.6, 4.6).toFixed(1) + 's');
                petal.style.setProperty('--petal-color', colours[i % colours.length]);
                petal.innerHTML = '<svg aria-hidden="true"><use href="#petal"/></svg>';
                field.appendChild(petal);
            }
        });
    }

    /* ------------------------------------------------------------------
       5. Countdown
       ------------------------------------------------------------------ */
    var countdown = document.getElementById('countdown');
    // Monday, 30 November 2026, 11:55 PM IST
    var weddingAt = new Date('2026-11-30T23:55:00+05:30').getTime();

    if (countdown) {
        var fields = {};
        Array.prototype.forEach.call(countdown.querySelectorAll('[data-unit]'), function (el) {
            fields[el.getAttribute('data-unit')] = el;
        });

        var pad = function (n, width) {
            var s = String(n);
            while (s.length < width) { s = '0' + s; }
            return s;
        };

        var tick = function () {
            var diff = Math.max(0, weddingAt - Date.now());
            var days = Math.floor(diff / 86400000);
            var hours = Math.floor(diff / 3600000) % 24;
            var minutes = Math.floor(diff / 60000) % 60;
            var seconds = Math.floor(diff / 1000) % 60;

            if (fields.days)    { fields.days.textContent = pad(days, days > 99 ? 3 : 2); }
            if (fields.hours)   { fields.hours.textContent = pad(hours, 2); }
            if (fields.minutes) { fields.minutes.textContent = pad(minutes, 2); }
            if (fields.seconds) { fields.seconds.textContent = pad(seconds, 2); }

            countdown.classList.toggle('is-today', diff === 0);
        };

        tick();
        window.setInterval(tick, 1000);
    }

    /* ------------------------------------------------------------------
       6. Save the Date (.ics)
       ------------------------------------------------------------------ */
    var saveDate = document.getElementById('save-date');

    if (saveDate) {
        saveDate.addEventListener('click', function () {
            var lines = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//Swastik & Soumya//Wedding//EN',
                'CALSCALE:GREGORIAN',
                'BEGIN:VEVENT',
                'UID:swastik-soumya-wedding-20261130@wedding',
                'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
                // 30 Nov 2026 11:55 PM IST = 18:25 UTC; Barat begins 8 PM IST = 14:30 UTC
                'DTSTART:20261130T143000Z',
                'DTEND:20261130T190000Z',
                'SUMMARY:Wedding of Swastik Kumar & Soumya Bharati',
                'DESCRIPTION:Barat from 8 PM\\, Bibah & Panigrahan at 11:55 PM.\\nReception: Friday 4 December 2026\\, 7:30 PM\\, River Inn Resorts\\, Durgapali\\, Sambalpur.',
                'LOCATION:The Adventure and Convention Resort\\, BBSR–Puri Road\\, Gudia Pokhari\\, Bhubaneswar\\, Odisha',
                'END:VEVENT',
                'END:VCALENDAR'
            ];
            var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'Swastik-Soumya-Wedding.ics';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        });
    }

    /* ------------------------------------------------------------------
       7. Optional images: public/images/ganesha.png, groom.png, bride.png
          replace the line-art when present.
       ------------------------------------------------------------------ */
    var artFigures = document.querySelectorAll('.deity, [data-art]');

    Array.prototype.forEach.call(artFigures, function (figure) {
        var img = figure.querySelector('img');
        if (!img) { return; }
        var show = function () {
            if (img.naturalWidth > 0) { figure.classList.add('has-image'); }
        };
        if (img.complete) { show(); } else { img.addEventListener('load', show); }
    });
    /* ------------------------------------------------------------------
       8. Golden timeline trail
          A fine light travels the timeline line in step with the scroll.
          When it reaches an event, that date badge brightens and two thin
          rings expand from it. Scrolling back up retraces the line, and an
          event can be reached again. Nothing runs until the visitor scrolls.
       ------------------------------------------------------------------ */
    var timeline = document.querySelector('.timeline');

    if (timeline && window.requestAnimationFrame) {
        (function () {
            var items = Array.prototype.slice.call(timeline.querySelectorAll('.timeline__item'));
            var canSpark = !reduceMotion && typeof timeline.animate === 'function';
            var READ_LINE = 0.6;      // the trail meets the page 60% of the way down the screen
            var UNLIGHT_GAP = 24;     // scroll back this far before an event can be reached again
            var SPARK_POOL = 16;

            var trailEl, headEl, ro;
            var sparks = [], marks = [];
            var height = 0, topAbs = 0;
            var current = 0, goal = 0, silent = true;
            var rafId = 0, syncId = 0, lastSpark = 0, sparkIdx = 0;
            var running = false;

            function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

            function build() {
                trailEl = document.createElement('div');
                trailEl.className = 'timeline__trail';
                trailEl.setAttribute('aria-hidden', 'true');

                var glow = document.createElement('span');
                glow.className = 'timeline__trail-glow';
                headEl = document.createElement('span');
                headEl.className = 'timeline__trail-head is-hidden';
                trailEl.appendChild(glow);
                trailEl.appendChild(headEl);

                sparks = [];
                if (canSpark) {
                    for (var i = 0; i < SPARK_POOL; i++) {
                        var spark = document.createElement('span');
                        spark.className = 'timeline__spark';
                        trailEl.appendChild(spark);
                        sparks.push(spark);
                    }
                }
                // First child, so event cards paint over the trail just as they do over the line
                timeline.insertBefore(trailEl, timeline.firstChild);
            }

            // Positions come from layout offsets, so scroll-reveal transforms never skew them.
            function measure() {
                topAbs = timeline.getBoundingClientRect().top + window.pageYOffset;
                height = timeline.offsetHeight;
                marks = items.map(function (item) {
                    var badge = item.querySelector('.timeline__date');
                    return {
                        item: item,
                        y: badge ? item.offsetTop + badge.offsetTop + badge.offsetHeight / 2 : 0,
                        lit: false,
                        busy: false,
                        pending: false,
                        timer: 0
                    };
                });
            }

            function target() {
                return clamp(window.pageYOffset + window.innerHeight * READ_LINE - topAbs, 0, height);
            }

            function arrive(mark, delay) {
                if (reduceMotion) { return; }
                // A ring that is still expanding is never cut short; a second
                // arrival (e.g. after a change of direction) waits for it to finish.
                if (mark.busy) { mark.pending = true; return; }
                mark.busy = true;
                mark.item.style.setProperty('--arrive-delay', delay.toFixed(2) + 's');
                mark.item.classList.add('is-arriving');
                mark.timer = window.setTimeout(function () {
                    mark.busy = false;
                    mark.item.classList.remove('is-arriving');
                    if (mark.pending) {
                        mark.pending = false;
                        var box = mark.item.getBoundingClientRect();
                        if (box.bottom > 0 && box.top < window.innerHeight) { arrive(mark, 0); }
                    }
                }, (delay + 2) * 1000);
            }

            function emitSpark(now) {
                if (!canSpark || now - lastSpark < 70) { return; }
                lastSpark = now;
                var spark = sparks[sparkIdx++ % sparks.length];
                if (spark._anim) { spark._anim.cancel(); }
                var dx = (Math.random() - 0.5) * 34;
                var dy = (Math.random() - 0.3) * 22;
                spark.style.top = current.toFixed(1) + 'px';
                spark._anim = spark.animate([
                    { transform: 'translate(0, 0) scale(1)', opacity: 0 },
                    { transform: 'translate(' + (dx * 0.4).toFixed(1) + 'px, ' + (dy * 0.4).toFixed(1) + 'px) scale(1)', opacity: 0.9, offset: 0.2 },
                    { transform: 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(0.2)', opacity: 0 }
                ], { duration: 700 + Math.random() * 300, easing: 'ease-out' });
            }

            function render(now, moved) {
                trailEl.style.setProperty('--trail-r', height ? (current / height).toFixed(4) : '0');
                trailEl.style.setProperty('--trail-y', current.toFixed(1) + 'px');
                headEl.classList.toggle('is-hidden', current <= 0.5 || current >= height - 0.5);

                var reached = [];
                var revisited = [];
                marks.forEach(function (mark) {
                    if (!mark.lit && current >= mark.y) {
                        mark.lit = true;
                        mark.item.classList.add('is-lit');
                        if (!silent) { reached.push(mark); }
                    } else if (mark.lit && current < mark.y - UNLIGHT_GAP) {
                        // The trail has met this event again on its way back up.
                        mark.lit = false;
                        mark.item.classList.remove('is-lit');
                        if (!silent) { revisited.push(mark); }
                    }
                });
                // Events passed in one jump get their moments one after another,
                // in the order the trail meets them (bottom to top when going up).
                reached.forEach(function (mark, i) { arrive(mark, Math.min(i, 4) * 0.14); });
                revisited.reverse().forEach(function (mark, i) { arrive(mark, Math.min(i, 4) * 0.14); });

                if (moved && !silent && current > 0.5 && current < height - 0.5) { emitSpark(now); }
            }

            function frame(now) {
                rafId = 0;
                var diff = goal - current;
                var before = current;
                current = (reduceMotion || Math.abs(diff) < 0.4) ? goal : current + diff * 0.16;
                render(now, Math.abs(current - before) > 0.3);
                if (current !== goal) { rafId = window.requestAnimationFrame(frame); }
            }

            function onScroll() {
                goal = target();
                if (!rafId) { rafId = window.requestAnimationFrame(frame); }
            }

            // Re-measure and jump straight to the right place, without playing arrivals.
            function resync() {
                syncId = 0;
                marks.forEach(function (mark) {
                    window.clearTimeout(mark.timer);
                    mark.busy = mark.pending = false;
                    mark.item.classList.remove('is-lit', 'is-arriving');
                });
                measure();
                silent = true;
                goal = current = target();
                render(0, false);
                silent = false;
            }

            function queueResync() {
                if (!syncId) { syncId = window.requestAnimationFrame(resync); }
            }

            function start() {
                if (running) { return; }
                running = true;
                build();
                resync();
                window.addEventListener('scroll', onScroll, { passive: true });
                window.addEventListener('resize', queueResync);
                window.addEventListener('load', queueResync);
                if ('ResizeObserver' in window) {
                    ro = new ResizeObserver(queueResync);
                    ro.observe(timeline);
                }
            }

            function stop() {
                if (!running) { return; }
                running = false;
                window.removeEventListener('scroll', onScroll);
                window.removeEventListener('resize', queueResync);
                window.removeEventListener('load', queueResync);
                if (ro) { ro.disconnect(); ro = null; }
                window.cancelAnimationFrame(rafId);
                window.cancelAnimationFrame(syncId);
                rafId = syncId = 0;
                marks.forEach(function (mark) {
                    window.clearTimeout(mark.timer);
                    mark.item.classList.remove('is-lit', 'is-arriving');
                });
                sparks.forEach(function (spark) { if (spark._anim) { spark._anim.cancel(); } });
                if (trailEl && trailEl.parentNode) { trailEl.parentNode.removeChild(trailEl); }
            }

            start();
            window.addEventListener('pagehide', stop);
            window.addEventListener('pageshow', function (event) { if (event.persisted) { start(); } });
        })();
    }
})();
