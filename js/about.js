// Interactive FAQ Toggle & Page Fade-in
document.addEventListener('DOMContentLoaded', () => {
  // Fade in main content smoothly
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('visible');
    }, 100);
  }
});

function toggleFaq(element) {
  const isActive = element.classList.contains('active');
  
  // Optional: Close all other FAQs
  document.querySelectorAll('.faq-item').forEach(item => {
    item.classList.remove('active');
  });

  // Toggle clicked FAQ
  if (!isActive) {
    element.classList.add('active');
  }
}