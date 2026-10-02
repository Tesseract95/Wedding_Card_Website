/* Swastik & Soumya · Wedding Website
   1. Intro screen that opens the site.
   2. Sticky nav: solid on scroll, highlights the current section.
   3. Sections and cards reveal as the guest scrolls.
   4. Falling marigold petals in the hero.
   5. Live countdown to the wedding.
   6. "Save the Date" downloads a calendar (.ics) file.
   7. A Ganesha photograph replaces the line-art if one has been added. */

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
    var petalField = document.getElementById('petals');

    if (petalField && !reduceMotion) {
        var colours = ['#FF9933', '#FFB85C', '#FFC857', '#FF7E1F', '#FFD08A'];
        var count = window.innerWidth < 600 ? 14 : 24;
        var rand = function (min, max) { return min + Math.random() * (max - min); };

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
            petalField.appendChild(petal);
        }
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
       7. Optional Ganesha image (public/images/ganesha.png)
       ------------------------------------------------------------------ */
    var deity = document.querySelector('.deity');
    var image = deity ? deity.querySelector('.deity__image') : null;

    if (image) {
        var showImage = function () {
            if (image.naturalWidth > 0) { deity.classList.add('has-image'); }
        };
        if (image.complete) { showImage(); } else { image.addEventListener('load', showImage); }
    }
})();
