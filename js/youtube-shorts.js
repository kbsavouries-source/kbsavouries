/* ==========================================================================
   KB Savouries – Taste Test (YouTube Shorts)

   HOW TO UPDATE
   -------------
   Add, remove or re-order links in the list below. That is all.
   • Paste the share link exactly as YouTube gives it (the "?si=..." part is fine).
   • Newest first? Put it at the top. The page shows them in this order.
   • Optional: use { url: '...', title: 'Poha Crunch' } to add a caption.
   • If the list is empty, the whole Taste Test section hides itself.
   ========================================================================== */

const KB_TASTE_TEST_SHORTS = [
  'https://youtube.com/shorts/_MB2p0ecJ6c?feature=share',
  'https://youtube.com/shorts/uLRgO-XbzLA?si=201R8tzEVWMNMRXb',
  'https://youtube.com/shorts/lZWmQOrwwqE',
  'https://youtube.com/shorts/GqFD92zPLjQ?si=Bg8wVKYIs-NyOTrR',
  'https://youtube.com/shorts/uEuEziPaKmA?si=dQo-y_cZhlCfWCeZ',
  'https://youtube.com/shorts/ZtOd2Kika8g?si=Vy_HLOm4-zb32n94',
  'https://youtube.com/shorts/WIzqbbereWM?si=UCmqRlBAXYb5NKED',
  'https://youtube.com/shorts/RL2QcejDhE8?si=BYK3UoJl4wcrSZWO',
  'https://youtube.com/shorts/ro2A0ZwP7qs?si=ga27XAU1G71M_ot9',
];

/* ==========================================================================
   Rendering (no need to edit below this line)
   ========================================================================== */
(function () {
  const section = document.getElementById('taste-test');
  const track = document.getElementById('taste-test-track');
  if (!section || !track) return;

  // Accepts shorts/, watch?v=, youtu.be/ and embed/ links, or a bare 11-char ID
  function getVideoId(url) {
    const m = String(url).trim().match(
      /(?:shorts\/|watch\?(?:.*&)?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$/
    );
    return m ? (m[1] || m[2]) : null;
  }

  const seen = new Set();
  const videos = KB_TASTE_TEST_SHORTS
    .map((item) => (typeof item === 'string' ? { url: item } : item))
    .map((item) => ({ id: getVideoId(item.url), title: item.title || '' }))
    .filter((v) => v.id && !seen.has(v.id) && seen.add(v.id));

  if (videos.length === 0) {
    section.hidden = true;
    return;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function posterHtml(v, i) {
    const label = v.title ? `Play taste test: ${escapeHtml(v.title)}` : `Play taste test video ${i + 1}`;
    return `
      <button type="button" class="tt-poster" aria-label="${label}">
        <img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" loading="lazy">
        <span class="tt-play" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
        ${v.title ? `<span class="tt-caption">${escapeHtml(v.title)}</span>` : ''}
      </button>`;
  }

  track.innerHTML = videos
    .map((v, i) => `<div class="tt-card" data-index="${i}">${posterHtml(v, i)}</div>`)
    .join('');

  // Load the real player only when tapped; only one video plays at a time
  function resetCards(except) {
    track.querySelectorAll('.tt-card').forEach((card) => {
      const i = Number(card.dataset.index);
      if (card !== except && card.querySelector('iframe')) card.innerHTML = posterHtml(videos[i], i);
    });
  }

  track.addEventListener('click', (e) => {
    const poster = e.target.closest('.tt-poster');
    if (!poster) return;
    const card = poster.closest('.tt-card');
    const v = videos[Number(card.dataset.index)];
    resetCards(card);
    card.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0"
      title="${escapeHtml(v.title || 'KB Savouries taste test')}" loading="lazy"
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  });

  // Arrows
  const prev = document.getElementById('taste-test-prev');
  const next = document.getElementById('taste-test-next');
  function step(dir) {
    const card = track.querySelector('.tt-card');
    const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
    track.scrollBy({ left: dir * ((card ? card.offsetWidth : 260) + gap) * 2, behavior: 'smooth' });
  }
  function updateArrows() {
    const max = track.scrollWidth - track.clientWidth - 2;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max;
    const overflow = max > 0;
    if (prev) prev.hidden = !overflow;
    if (next) next.hidden = !overflow;
  }
  if (prev) prev.addEventListener('click', () => step(-1));
  if (next) next.addEventListener('click', () => step(1));
  track.addEventListener('scroll', () => requestAnimationFrame(updateArrows), { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
})();