// Toggle Collapsible Recipe Card Details
function toggleRecipe(cardElement) {
  if (cardElement) {
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
  // Immediately reveal main content with smooth transition on load
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('visible');
    }, 50);
  }

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
});