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

// Logo Click Handler — Reloads page to reset intro screen
document.addEventListener('DOMContentLoaded', () => {
  const logoLink = document.getElementById('logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.reload();
    });
  }
});