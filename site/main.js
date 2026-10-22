// Whittle site behaviour. No dependencies, no network, no storage beyond the theme choice.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ── theme ─────────────────────────────────────────────────────────────── */
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function swapImages() {
    var t = currentTheme();
    $$('img[data-dark][data-light]').forEach(function (img) {
      var want = img.getAttribute('data-' + t);
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    });
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#f1f1ee' : '#0e1012');
  }
  $('#theme').addEventListener('click', function () {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('whittle-theme', next); } catch (e) { /* ignore */ }
    swapImages();
  });
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', swapImages);
  swapImages();

  /* ── nav ───────────────────────────────────────────────────────────────── */
  var nav = $('#nav');
  function onScroll() { nav.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  var burger = $('#burger'), links = $('#links');
  function closeMenu() { links.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', function () {
    var open = links.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', links).forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  /* ── reveal on scroll ──────────────────────────────────────────────────── */
  var revealables = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── count up ──────────────────────────────────────────────────────────── */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    var node = el.firstChild;
    if (!node || node.nodeType !== 3) { node = document.createTextNode(''); el.insertBefore(node, el.firstChild); }
    if (reduce || target === 0) { node.nodeValue = target.toFixed(dec); return; }
    var start = performance.now(), dur = 1400;
    function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - p, 4);
      node.nodeValue = (target * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { countUp(en.target); co.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ── tabs (showcase + install) ─────────────────────────────────────────── */
  function tabs(list, tabSel) {
    var items = $$(tabSel, list);
    function select(tab, focus) {
      items.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (!panel) return;
        panel.hidden = !on;
        panel.classList.toggle('is-on', on);
      });
      if (focus) tab.focus();
    }
    items.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = items.length, j = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        if (j >= 0) { e.preventDefault(); select(items[j], true); }
      });
    });
  }
  tabs($('#tabs'), '.tab');
  tabs($('.install__tabs'), '.itab');

  /* ── copy buttons ──────────────────────────────────────────────────────── */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'sr';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  $$('.copy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var id = btn.getAttribute('data-copy-target');
      if (id) text = document.getElementById(id).innerText;
      if (btn.hasAttribute('data-copy-target-prev')) text = btn.previousElementSibling.innerText;
      var label = $('span', btn);
      copyText(text).then(function () {
        btn.classList.add('is-done'); label.textContent = 'Copied';
      }, function () {
        label.textContent = 'Select and copy';
      }).then(function () {
        setTimeout(function () { btn.classList.remove('is-done'); label.textContent = 'Copy'; }, 1800);
      });
    });
  });

  /* ── hero tilt ─────────────────────────────────────────────────────────── */
  var stage = $('.stage'), shot = $('#shot');
  if (stage && shot && !reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      shot.style.transform = 'rotateY(' + (x * 7).toFixed(2) + 'deg) rotateX(' + (-y * 5).toFixed(2) + 'deg)';
    });
    stage.addEventListener('pointerleave', function () { shot.style.transform = ''; });
  }

  /* ── terminal ──────────────────────────────────────────────────────────── */
  var term = $('#term');
  if (term) {
    var S = [
      [['p', '$ '], ['c', 'whittle scan']],
      [['m', '  17 rules, 5 app sources, nothing touched']],
      [['c', '  Caches & logs      '], ['g', '21.4 GB'], ['m', '   safe']],
      [['c', '  Dev projects       '], ['g', '10.2 GB'], ['m', '   safe']],
      [['c', '  App leftovers       '], ['g', '3.7 GB'], ['m', '   review']],
      [['c', '  Device backups      '], ['g', '6.1 GB'], ['m', '   manual, not counted']],
      [['c', '  35.3 GB can go, '], ['g', '31.6 GB'], ['c', ' of it safe']],
      [['c', '']],
      [['p', '$ '], ['c', 'whittle clean']],
      [['c', '  Moved '], ['g', '31.6 GB'], ['c', ' to quarantine for 30 days']],
      [['m', '  undo with: whittle undo']],
      [['c', '']],
      [['p', '$ '], ['c', 'whittle undo']],
      [['c', '  Put back '], ['g', '31.6 GB'], ['c', '. Nothing was lost.']]
    ];
    var typed = { c: true, p: true }; // only commands are typed, results appear at once
    var caret = document.createElement('span'); caret.className = 'caret';
    var started = false;
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var line = function (segs, instant) {
      var row = document.createElement('div');
      term.insertBefore(row, caret.parentNode === term ? caret : null);
      var chain = Promise.resolve();
      segs.forEach(function (seg) {
        var sp = document.createElement('span'); sp.className = seg[0]; row.appendChild(sp);
        var isCmd = seg[0] === 'c' && /^whittle/.test(seg[1]) && !instant;
        if (!isCmd) { sp.textContent = seg[1] || '\u00a0'; return; }
        chain = chain.then(function () {
          return new Promise(function (resolve) {
            var i = 0;
            (function step() { sp.textContent = seg[1].slice(0, ++i); if (i < seg[1].length) setTimeout(step, 38 + Math.random() * 40); else resolve(); })();
          });
        });
      });
      return chain;
    };
    var run = function () {
      if (started) return; started = true;
      term.textContent = '';
      if (reduce) { S.forEach(function (l) { line(l, true); }); return; }
      term.appendChild(caret);
      var p = Promise.resolve();
      S.forEach(function (l) {
        p = p.then(function () { return line(l, false); }).then(function () {
          var isCmd = l[1] && /^whittle/.test(l[1][1]);
          return wait(isCmd ? 420 : 110);
        });
      });
    };
    if ('IntersectionObserver' in window) {
      var to = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { run(); to.disconnect(); } }, { threshold: 0.4 });
      to.observe(term);
    } else { run(); }
  }
})();
