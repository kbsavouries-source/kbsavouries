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

  const navbar = document.querySelector('.navbar');
  let lastScrollY = window.scrollY;

  if (navbar) {
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        navbar.classList.add('nav-hidden');
      } else {
        navbar.classList.remove('nav-hidden');
      }
      lastScrollY = currentScrollY;
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