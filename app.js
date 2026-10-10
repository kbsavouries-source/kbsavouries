// Intro Overlay Transition Handler
function enterSite() {
  const introScreen = document.getElementById('intro-screen');
  const mainContent = document.getElementById('main-content');

  if (introScreen && mainContent) {
    // Trigger fade out on splash screen
    introScreen.classList.add('fade-out');

    // Reveal main content smooth transition
    mainContent.classList.add('visible');

    // Remove intro element from DOM after transition finishes
    setTimeout(() => {
      introScreen.style.display = 'none';
    }, 800);
  }
}

// Smooth Horizontal Carousel Scroll Handler
function scrollCarousel(direction) {
  const recipeGrid = document.getElementById('recipeGrid');
  if (recipeGrid) {
    const scrollAmount = 364; // card width (340px) + gap (24px)
    recipeGrid.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  }
}

// Interactive Window Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Logo Click Handler — Reloads page to reset intro screen
  const logoLink = document.getElementById('logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.reload();
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
});