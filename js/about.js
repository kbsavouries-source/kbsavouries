// Fade in main content smoothly & handle FAQ/Hamburger interactivity
document.addEventListener('DOMContentLoaded', () => {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('visible');
    }, 100);
  }
});

function toggleFaq(element) {
  const isActive = element.classList.contains('active');
  
  // Close all other FAQs
  document.querySelectorAll('.faq-item').forEach(item => {
    item.classList.remove('active');
  });

  // Toggle clicked FAQ
  if (!isActive) {
    element.classList.add('active');
  }
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