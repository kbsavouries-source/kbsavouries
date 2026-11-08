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

// Global Lenis Instance
let lenisInstance = null;

function initFuturisticScroll() {
  if (typeof Lenis === 'undefined') return;

  // 1. Initialize Lenis Smooth Scroll
  lenisInstance = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.5,
  });

  // 2. Connect Lenis to GSAP ScrollTrigger if available
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    lenisInstance.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenisInstance.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // GSAP Scroll Animations
    // A. Fade & Reveal Sections on Scroll
    const revealElements = document.querySelectorAll('.gsap-reveal');
    revealElements.forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });

    // B. Hero Image Scale Parallax
    const heroStage = document.querySelector('.kbh-stage');
    if (heroStage) {
      gsap.to('.kbh-slides', {
        yPercent: 8,
        scale: 1.05,
        transformOrigin: 'center top',
        ease: 'none',
        scrollTrigger: {
          trigger: '#video-story',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }

    // C. Center Product Images Floating Parallax
    const parallaxImgs = document.querySelectorAll('.gsap-parallax-img');
    parallaxImgs.forEach((img) => {
      gsap.to(img, {
        y: -14,
        scale: 1.03,
        ease: 'none',
        scrollTrigger: {
          trigger: img,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
    });
  } else {
    // Fallback animation frame loop if GSAP isn't loaded
    function raf(time) {
      lenisInstance.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }
}

// Toggle Mobile Menu Drawer with Automatic Scroll to Top
function toggleMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const menuDrawer = document.getElementById('mobileMenuDrawer');
  
  if (menuBtn && menuDrawer) {
    if (!menuDrawer.classList.contains('open')) {
      if (lenisInstance) {
        lenisInstance.scrollTo(0, { duration: 0.8 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    
    menuBtn.classList.toggle('active');
    menuDrawer.classList.toggle('open');
  }
}

function toggleRecipe(cardElement) {
  if (cardElement) {
    playCrunchSound();
    cardElement.classList.toggle('expanded');
    cardElement.setAttribute('aria-expanded', cardElement.classList.contains('expanded'));
    const toggleText = cardElement.querySelector('.toggle-text');
    if (toggleText) {
      const isBenefit = cardElement.closest('.recipes-section') !== null;
      if (isBenefit) {
        toggleText.textContent = cardElement.classList.contains('expanded') ? 'Show Less' : 'Learn More';
      } else {
        toggleText.textContent = cardElement.classList.contains('expanded') ? 'Hide Recipe' : 'View Recipe';
      }
    }
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
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
  initFuturisticScroll();

  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('visible');
    }, 50);
  }

  const progress = document.getElementById('scrollProgress');
  const navbar = document.querySelector('.navbar');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress && max > 0) progress.style.transform = 'scaleX(' + Math.min(1, window.scrollY / max) + ')';
    if (navbar) navbar.classList.toggle('is-scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('.recipe-card').forEach((card) => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRecipe(card); }
    });
  });

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
      if (lenisInstance) {
        lenisInstance.scrollTo(0, { duration: 1 });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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
});

// PWA install prompt
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

// Hero slideshow
document.addEventListener('DOMContentLoaded', () => {
  const hero = document.getElementById('video-story');
  if (!hero) return;

  const SLIDE_MS = 4000;
  const slides = [...hero.querySelectorAll('.kbh-slide')];
  if (slides.length < 2) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
window.playCrunchSound = playCrunchSound;