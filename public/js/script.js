/* Swastik & Soumya · Wedding Invitation
   Behaviour kept deliberately restrained:
   1. The closed card (two doors) swings open on request.
   2. Inner panels rise gently into view as the guest scrolls.
   3. A Ganesha photograph replaces the line-art if one has been added. */

(function () {
    'use strict';

    var html = document.documentElement;
    html.classList.add('js');

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ------------------------------------------------------------------
       1. The closed card
       ------------------------------------------------------------------ */
    var gate = document.getElementById('gate');
    var openButton = document.getElementById('gate-open');

    function removeGate() {
        if (gate && gate.parentNode) {
            gate.parentNode.removeChild(gate);
        }
    }

    function finishOpening() {
        html.classList.remove('card-closed');
        html.classList.remove('card-opening');
        removeGate();

        // Hand focus to the couple's names so keyboard and screen-reader
        // users land on the first page of the open card.
        var heading = document.getElementById('couple-names');
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            try {
                heading.focus({ preventScroll: true });
            } catch (err) {
                heading.focus();
            }
        }
    }

    function openCard() {
        if (!html.classList.contains('card-closed') || html.classList.contains('card-opening')) {
            return;
        }

        html.classList.add('card-opening');

        if (reduceMotion) {
            finishOpening();
            return;
        }

        gate.classList.add('is-opening');

        var done = false;
        var finish = function () {
            if (done) { return; }
            done = true;
            finishOpening();
        };

        var rightLeaf = gate.querySelector('.gate__leaf--right');
        if (rightLeaf) {
            rightLeaf.addEventListener('transitionend', function (event) {
                if (event.propertyName === 'transform') { finish(); }
            });
        }

        // Safety net in case transitionend never fires.
        window.setTimeout(finish, 2600);
    }

    if (gate && html.classList.contains('card-closed')) {
        window.scrollTo(0, 0);

        if (openButton) {
            openButton.addEventListener('click', openCard);
        }

        // Tapping either door also opens the card.
        gate.addEventListener('click', function (event) {
            if (event.target.closest && event.target.closest('.gate__leaf')) {
                openCard();
            }
        });
    } else {
        removeGate();
    }

    /* ------------------------------------------------------------------
       2. Reveal inner panels as they enter the viewport
       ------------------------------------------------------------------ */
    var panels = document.querySelectorAll('.panel:not(.panel--cover)');

    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

        panels.forEach(function (panel) {
            observer.observe(panel);
        });
    } else {
        panels.forEach(function (panel) {
            panel.classList.add('is-visible');
        });
    }

    /* ------------------------------------------------------------------
       3. Optional Ganesha image (public/images/ganesha.png)
       ------------------------------------------------------------------ */
    var deity = document.querySelector('.deity');
    var image = deity ? deity.querySelector('.deity__image') : null;

    if (image) {
        var showImage = function () {
            if (image.naturalWidth > 0) {
                deity.classList.add('has-image');
            }
        };

        if (image.complete) {
            showImage();
        } else {
            image.addEventListener('load', showImage);
        }
    }
})();
