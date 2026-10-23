// Smooth page entrance transition & Mobile drawer handler
document.addEventListener('DOMContentLoaded', () => {
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('visible');
    }, 100);
  }
});

// Mobile Hamburger Menu Drawer Toggle
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
  
function toggleMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const menuDrawer = document.getElementById('mobileMenuDrawer');
  
  if (menuBtn && menuDrawer) {
    const isOpen = menuDrawer.classList.contains('open');
    
    if (!isOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.style.overflow = 'hidden'; // Prevents background page scrolling
    } else {
      document.body.style.overflow = ''; // Restores background scrolling
    }
    
    menuBtn.classList.toggle('active');
    menuDrawer.classList.toggle('open');
  }
}
}