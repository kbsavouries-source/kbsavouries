/* ==========================================================================
   KB SAVOURIES — EXPERIENCE LAYER
   Custom cursor · velocity marquee · scroll-lit manifesto ·
   hero shrink · giant section numerals · footer wordmark · magnetic buttons
   Needs: GSAP + ScrollTrigger + Lenis (already loaded by index.html)
   ========================================================================== */
(function () {
  'use strict';

  const hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. CUSTOM CURSOR ---------- */
  function initCursor() {
    if (!finePointer || !hasGSAP) return;

    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'kb-cursor-dot';
    ring.className = 'kb-cursor-ring';
    ring.innerHTML = '<span class="kb-cursor-label"></span>';
    document.body.append(ring, dot);
    const label = ring.querySelector('.kb-cursor-label');

    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 });
    const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });

    let shown = false;
    window.addEventListener('pointermove', (e) => {
      if (!shown) {
        shown = true;
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
        gsap.to([dot, ring], { opacity: 1, duration: 0.3 });
        document.documentElement.classList.add('has-cursor');
      }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    }, { passive: true });
    document.addEventListener('pointerleave', () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 }));
    document.addEventListener('pointerenter', () => shown && gsap.to([dot, ring], { opacity: 1, duration: 0.2 }));

    function pick(el) {
      if (!el || !el.closest) return null;
      if (el.closest('a, button, .btn, .carousel-btn, .tt-arrow')) return { c: 'is-link' };
      const card = el.closest('.recipe-card');
      if (card) return { c: 'is-label', l: card.classList.contains('expanded') ? 'Close' : 'Open' };
      if (el.closest('.recipe-grid, .tt-track')) return { c: 'is-label', l: 'Drag' };
      if (el.closest('.poha-center-image-wrapper')) return { c: 'is-label', l: 'Crunch' };
      return null;
    }
    function apply(el) {
      const p = pick(el);
      ring.classList.toggle('is-link', !!p && p.c === 'is-link');
      ring.classList.toggle('is-label', !!p && p.c === 'is-label');
      dot.classList.toggle('is-hidden', !!p);
      label.textContent = p && p.l ? p.l : '';
    }
    document.addEventListener('pointerover', (e) => apply(e.target));
    document.addEventListener('click', (e) => setTimeout(() => apply(e.target), 0));
    window.addEventListener('pointerdown', () => ring.classList.add('is-down'));
    window.addEventListener('pointerup', () => ring.classList.remove('is-down'));
  }

  /* ---------- 3. VELOCITY MARQUEE ---------- */
  function initMarquee() {
    const wrap = document.querySelector('.kb-marquee');
    const track = wrap && wrap.querySelector('.marquee-track');
    if (!track) return;

    let pos = 0, dir = -1, visible = true;
    new IntersectionObserver((en) => (visible = en[0].isIntersecting), { rootMargin: '200px' }).observe(wrap);
    const skewTo = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });

    gsap.ticker.add(() => {
      if (!visible) return;
      const v = (typeof lenisInstance !== 'undefined' && lenisInstance) ? lenisInstance.velocity : 0;
      if (Math.abs(v) > 0.05) dir = v > 0 ? -1 : 1;           // scroll direction flips the marquee
      pos += dir * (0.045 + Math.min(Math.abs(v), 40) * 0.012); // scroll speed accelerates it
      pos = gsap.utils.wrap(-50, 0, pos);
      gsap.set(track, { xPercent: pos });
      skewTo(gsap.utils.clamp(-9, 9, -v * 0.45));
    });
  }

  /* ---------- 4. SCROLL-LIT MANIFESTO ---------- */
  function wrapWords(node) {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
          const sp = document.createElement('span');
          sp.className = 'mw';
          sp.textContent = part;
          frag.appendChild(sp);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) wrapWords(n);
    });
  }
  function initManifesto() {
    const p = document.getElementById('manifesto');
    if (!p) return;
    wrapWords(p);
    gsap.fromTo(p.querySelectorAll('.mw'), { opacity: 0.12 }, {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 48%', scrub: true },
    });
    gsap.from('.manifesto-eyebrow', {
      y: 20, opacity: 0, duration: 1, ease: 'power4.out',
      scrollTrigger: { trigger: '.manifesto-eyebrow', start: 'top 90%' },
    });
  }

  /* ---------- 5. HERO SHRINKS INTO A CARD AS YOU SCROLL ---------- */
  function initHeroShrink() {
    const stage = document.querySelector('.kbh-stage');
    if (!stage) return;
    gsap.fromTo(stage,
      { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)' },
      {
        clipPath: 'inset(0% 5% 0% 5% round 0px 0px 44px 44px)', ease: 'none',
        scrollTrigger: { trigger: '#video-story', start: 'top 90px', end: 'bottom 35%', scrub: true },
      });
  }

  /* ---------- 6. GIANT OUTLINED SECTION NUMERALS ---------- */
  function initSectionNumerals() {
    document.querySelectorAll('.recipes-section').forEach((sec, i) => {
      const n = document.createElement('span');
      n.className = 'sec-index';
      n.setAttribute('aria-hidden', 'true');
      n.textContent = String(i + 1).padStart(2, '0');
      sec.prepend(n);
      gsap.fromTo(n, { yPercent: -14 }, {
        yPercent: 26, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ---------- 7. FOOTER WORDMARK ---------- */
  function initFooterWordmark() {
    const wm = document.getElementById('footerWordmark');
    if (!wm) return;
    const text = wm.textContent.trim();
    wm.textContent = '';
    [...text].forEach((ch) => {
      const mask = document.createElement('span');
      mask.className = 'split-mask';
      const inner = document.createElement('span');
      inner.className = 'split-inner wm-letter';
      inner.innerHTML = ch === ' ' ? '&nbsp;' : ch;
      mask.appendChild(inner);
      wm.appendChild(mask);
    });
    gsap.from(wm.querySelectorAll('.wm-letter'), {
      yPercent: 120, duration: 1.2, ease: 'expo.out', stagger: 0.045,
      scrollTrigger: { trigger: wm, start: 'top 95%', once: true },
    });
  }

  /* ---------- 8. MAGNETIC BUTTONS ---------- */
  function initMagnetic() {
    if (!finePointer) return;
    document.querySelectorAll('.kbh-btn-gold, .navbar .btn-order').forEach((el) => {
      el.classList.add('is-magnetic');
      const xTo = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // app.js has already run its own DOMContentLoaded handler (Lenis + base GSAP exist)
    if (!hasGSAP || reduce) return;
    initCursor();
    initMarquee();
    initManifesto();
    initHeroShrink();
    initSectionNumerals();
    initFooterWordmark();
    initMagnetic();
    window.addEventListener('load', () => ScrollTrigger.refresh());
  });
})();