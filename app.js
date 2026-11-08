const crunchAudio = new Audio('./Assets/crunch sfx.wav');
crunchAudio.volume = 0.5;

function playCrunchSound() {
  crunchAudio.currentTime = 0;
  crunchAudio.play().catch((err) => {});
}

function playInitialCrunch() {
  crunchAudio.currentTime = 0;
  crunchAudio.play().catch(() => {
    const unlockAudio = () => {
      crunchAudio.play().catch(() => {});
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
  });
}

// Toggle Mobile Menu Drawer with Automatic Scroll to Top
function toggleMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const menuDrawer = document.getElementById('mobileMenuDrawer');
  
  if (menuBtn && menuDrawer) {
    if (!menuDrawer.classList.contains('open')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    menuBtn.classList.toggle('active');
    menuDrawer.classList.toggle('open');
  }
}

function toggleRecipe(cardElement) {
  if (cardElement) {
    playCrunchSound();
    cardElement.classList.toggle('expanded');
    const toggleText = cardElement.querySelector('.toggle-text');
    if (toggleText) {
      const isBenefit = cardElement.closest('#benefitGrid') !== null;
      if (isBenefit) {
        toggleText.textContent = cardElement.classList.contains('expanded') ? 'Show Less' : 'Learn More';
      } else {
        toggleText.textContent = cardElement.classList.contains('expanded') ? 'Hide Recipe' : 'View Recipe';
      }
    }
  }
}

function scrollCarousel(gridId, direction) {
  playCrunchSound();
  const grid = document.getElementById(gridId);
  if (grid) {
    const scrollAmount = 364;
    grid.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  }
}

function openDisclaimerModal(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('disclaimer-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

function closeDisclaimerModal() {
  const modal = document.getElementById('disclaimer-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

document.addEventListener('click', (e) => {
  const modal = document.getElementById('disclaimer-modal');
  if (e.target === modal) {
    closeDisclaimerModal();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  playInitialCrunch();

  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('visible');
    }, 50);
  }

  const zoomTargets = document.querySelectorAll('.zoom-on-scroll');
  function updateZoomScale() {
    const windowHeight = window.innerHeight;
    zoomTargets.forEach(el => {
      const rect = el.getBoundingClientRect();
      const progress = Math.min(Math.max((windowHeight - rect.top) / windowHeight, 0), 1);
      const scaleValue = 1 + (progress * 0.05);
      el.style.setProperty('--scroll-scale', scaleValue.toFixed(3));
    });
  }

  window.addEventListener('scroll', () => {
    requestAnimationFrame(updateZoomScale);
  });
  updateZoomScale();

  const interactiveElements = document.querySelectorAll('.btn, .nav-brand, a, .snack-order-link');
  
  interactiveElements.forEach((el) => {
    el.addEventListener('click', (e) => {
      const href = el.getAttribute('href') || '';
      const text = el.textContent.trim().toLowerCase();

      const isExcluded = 
        el.classList.contains('btn-order') || 
        el.classList.contains('snack-order-link') || 
        text.includes('order fresh') || 
        text.includes('order pack') || 
        text.includes('enquire') ||
        text.includes('book keeping') ||
        text.includes('product disclaimer') ||
        href.includes('books.html');

      if (!isExcluded) {
        playCrunchSound();
      }

      const target = el.getAttribute('target');
      
      if (href && !href.startsWith('#') && el.tagName === 'A') {
        if (target === '_blank') return;

        const delay = isExcluded ? 0 : 150;
        e.preventDefault();
        setTimeout(() => {
          window.location.href = href;
        }, delay);
      }
    });
  });

  const logoLink = document.getElementById('logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const footerContent = document.querySelector('.footer-content');
  if (footerContent) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          footerContent.classList.add('visible');
        }
      });
    }, { threshold: 0.2 });

    observer.observe(footerContent);
  }

  // Render Featured Customer Reviews from Firestore Cloud Storage (Strictly Limited to 10)
  const reviewsGrid = document.getElementById('featured-reviews-grid');
  if (reviewsGrid) {
      localStorage.removeItem('kb_customer_reviews');

      import("https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js").then(({ initializeApp }) => {
          import("https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js").then(({ getFirestore, collection, getDocs, query, orderBy, limit }) => {
              const firebaseConfig = {
                  apiKey: "AIzaSyCullX49Und6AmRgg8UL9hP1cLvQ-KVnEI",
                  authDomain: "kb-savouries.firebaseapp.com",
                  projectId: "kb-savouries",
                  storageBucket: "kb-savouries.firebasestorage.app",
                  messagingSenderId: "805966330754",
                  appId: "1:805966330754:web:22cf30e2499298e4456d9b"
              };

              const firebaseApp = initializeApp(firebaseConfig);
              const db = getFirestore(firebaseApp);

              const fetchReviews = async () => {
                  try {
                      // Fetch only the latest 10 reviews to protect free tier Spark quota
                      const q = query(
                          collection(db, 'reviews'), 
                          orderBy('createdAt', 'desc'), 
                          limit(10)
                      );
                      
                      const querySnapshot = await getDocs(q);
                      const cloudReviews = querySnapshot.docs.map(doc => doc.data());

                      if (cloudReviews.length === 0) {
                          reviewsGrid.innerHTML = `
                              <div style="grid-column: 1 / -1; text-align: center; color: #64748B; padding: 24px; font-weight: 500;">
                                  No reviews yet. Be the first to leave a review! ⭐
                              </div>
                          `;
                          return;
                      }

                      reviewsGrid.innerHTML = cloudReviews.map(r => `
                          <div style="background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(20px); border: 1.5px solid rgba(255, 255, 255, 0.9); border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04); display: flex; flex-direction: column; justify-content: space-between;">
                              <div>
                                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                      <strong style="font-size: 1.05rem; color: #0F172A;">${r.name}</strong>
                                      <span style="color: #F59E0B; font-size: 1.1rem; letter-spacing: 2px;">${'★'.repeat(r.rating || 5)}</span>
                                  </div>
                                  <div style="font-size: 0.75rem; font-weight: 800; color: #EA580C; text-transform: uppercase; margin-bottom: 12px;">Tried: ${r.product}</div>
                                  <p style="color: #475569; font-size: 0.92rem; line-height: 1.5; margin-bottom: 16px;">"${r.comment}"</p>
                              </div>
                              <div style="font-size: 0.75rem; color: #94A3B8; border-top: 1px solid rgba(254, 215, 170, 0.5); padding-top: 10px;">Verified Snacker • ${r.date}</div>
                          </div>
                      `).join('');
                  } catch (err) {
                      console.error("Error fetching Firestore reviews:", err);
                  }
              };

              fetchReviews();
          });
      });
  }
});

// ==========================================================================
// PWA install prompt
// ==========================================================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function triggerInstallApp(e) {
  if (e) e.preventDefault();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    alert("To install KB Savouries on your iPhone:\n1. Tap the 'Share' button at the bottom of Safari.\n2. Scroll down and select 'Add to Home Screen'.");
    return;
  }

  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
    });
  } else {
    alert("App is already installed, or your browser doesn't support direct installation prompts. You can check your browser menu to install the app.");
  }
}

// ==========================================================================
// Hero slideshow (full-bleed, cross-fades every 4 seconds)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const hero = document.getElementById('video-story');
  if (!hero) return;

  const SLIDE_MS = 4000;
  const slides = [...hero.querySelectorAll('.kbh-slide')];
  if (slides.length < 2) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Preload every photo so the cross-fade never flickers
  slides.forEach((s) => {
    const m = (s.style.backgroundImage || '').match(/url\(["']?(.*?)["']?\)/);
    if (m) new Image().src = m[1];
  });

  let current = 0;
  let timer = null;

  function show(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === current));
  }
  function start() { clearInterval(timer); timer = setInterval(() => show(current + 1), SLIDE_MS); }
  function stop() { clearInterval(timer); }

  hero.addEventListener('mouseenter', stop);
  hero.addEventListener('mouseleave', start);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
});