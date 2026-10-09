// Intro Overlay Transition Handler
function enterSite() {
  const introScreen = document.getElementById('intro-screen');
  const mainContent = document.getElementById('main-content');

  // Trigger fade out on splash screen
  introScreen.classList.add('fade-out');

  // Reveal main content smooth transition
  mainContent.classList.add('visible');

  // Remove intro element from DOM after transition finishes
  setTimeout(() => {
    introScreen.style.display = 'none';
  }, 800);
}