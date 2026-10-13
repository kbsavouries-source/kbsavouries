// Initialize Audio for Crunch SFX
const crunchAudio = new Audio('./Assets/crunch sfx.wav');
crunchAudio.volume = 0.5; // Adjust volume as needed (0.0 to 1.0)

// Helper function to play sound safely on interaction
function playCrunchSound() {
  crunchAudio.currentTime = 0; // Rewind to start for rapid clicks
  crunchAudio.play().catch((err) => {
    // Browsers block audio playback until initial user interaction; safely caught
  });
}

// Play crunch sound on initial landing page load
function playInitialCrunch() {
  crunchAudio.currentTime = 0;
  crunchAudio.play().catch(() => {
    // If blocked by browser autoplay policy, play it on the user's very first click anywhere on the page
    const unlockAudio = () => {
      crunchAudio.play().catch(() => {});
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
  });
}

// Toggle Collapsible Recipe Card Details
function toggleRecipe(cardElement) {
  if (cardElement) {
    playCrunchSound(); // Play crunch sound on card toggle
    cardElement.classList.toggle('expanded');
    
    // Update toggle text dynamically based on section
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

// Smooth Horizontal Carousel Scroll Handler for Multiple Grids
function scrollCarousel(gridId, direction) {
  playCrunchSound(); // Play crunch sound on carousel button click
  const grid = document.getElementById(gridId);
  if (grid) {
    const scrollAmount = 364; // card width (340px) + gap (24px)
    grid.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  }
}

// Interactive Window Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Trigger initial crunch sound on load
  playInitialCrunch();

  // Immediately reveal main content with smooth transition on load
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('visible');
    }, 50);
  }

  // Intercept link and button clicks
  const interactiveElements = document.querySelectorAll('.btn, .nav-brand, a, .snack-order-link');
  
  interactiveElements.forEach((el) => {
    el.addEventListener('click', (e) => {
      // Define href and text context for exclusion checks
      const href = el.getAttribute('href') || '';
      const text = el.textContent.trim().toLowerCase();

      // Check if the clicked element is one of the excluded actions
      const isExcluded = 
        el.classList.contains('btn-order') || 
        el.classList.contains('snack-order-link') || 
        text.includes('order fresh') || 
        text.includes('order pack') || 
        text.includes('enquire') ||
        text.includes('book keeping') ||
        href.includes('books.html');

      // Only play the crunch sound if it is NOT an excluded action
      if (!isExcluded) {
        playCrunchSound();
      }

      // Standard link navigation delay handling
      const target = el.getAttribute('target');
      
      if (href && !href.startsWith('#') && el.tagName === 'A') {
        if (target === '_blank') return;

        // If it played sound, add a tiny delay; if excluded, navigate instantly without audio delay
        const delay = isExcluded ? 0 : 150;
        
        e.preventDefault();
        setTimeout(() => {
          window.location.href = href;
        }, delay);
      }
    });
  });

  // Logo Click Handler — Smoothly scrolls back to top
  const logoLink = document.getElementById('logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Smooth Header Scroll Disappear / Reveal Handler
  const navbar = document.querySelector('.navbar');
  let lastScrollY = window.scrollY;

  if (navbar) {
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;

      // Only hide header when scrolling down past 80px
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        navbar.classList.add('nav-hidden');
      } else {
        navbar.classList.remove('nav-hidden');
      }

      lastScrollY = currentScrollY;
    });
  }

  // Footer Content Scroll Fade-In Observer
  const footerContent = document.querySelector('.footer-content');
  if (footerContent) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          footerContent.classList.add('visible');
        }
      });
    }, {
      threshold: 0.2
    });

    observer.observe(footerContent);
  }

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('SW Registered:', reg.scope))
        .catch((err) => console.error('SW Registration Failed:', err));
    });
  }

  // PWA Install Prompt Handler
  let deferredPrompt;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'inline-block';
      
      installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the PWA install prompt');
          }
          deferredPrompt = null;
        });
      });
    }
  });
});