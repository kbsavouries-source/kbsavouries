// Select Package from Pricing Table and Smooth Scroll to Form
function selectPackage(size, qty, price) {
  const sizeSelect = document.getElementById('selected-size');
  if (sizeSelect) {
    sizeSelect.value = size;
    updateFormSelection();
  }

  const orderSection = document.getElementById('order-section');
  if (orderSection) {
    orderSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Update helper text when dropdown selection changes
function updateFormSelection() {
  const sizeSelect = document.getElementById('selected-size');
  const infoText = document.getElementById('selected-package-info');
  
  if (sizeSelect && infoText) {
    const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
    const size = sizeSelect.value;
    const qty = selectedOption.getAttribute('data-qty');
    const price = selectedOption.getAttribute('data-price');
    
    infoText.innerHTML = `Selected Pouch Size: <strong>Size ${size} (${qty})</strong> at <strong>₹${price}</strong> per pack.`;
  }
}

// Dummy calculation hook for quantity inputs
function calculateTotal() {
  // Optional live update logic
}

// Custom Modal Popup Handlers with Auto-Scroll to Top
function showModal(message) {
  const modal = document.getElementById('custom-modal');
  const msgEl = document.getElementById('modal-message');
  if (modal && msgEl) {
    msgEl.textContent = message;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    // Automatically scroll to the top so the popup is immediately visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function closeModal() {
  const modal = document.getElementById('custom-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// Calculate and generate order summary table with minimum order value check (₹200)
function handleFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const sizeSelect = document.getElementById('selected-size');
  const quantity = parseInt(document.getElementById('customer-qty').value, 10) || 1;

  if (address.length < 10) {
    showModal('Please enter a valid address with at least 10 characters.');
    document.getElementById('customer-address').focus();
    return;
  }

  if (!sizeSelect.value) {
    showModal('Please select a pouch size.');
    return;
  }

  const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
  const sizeLetter = sizeSelect.value;
  const pouchQty = selectedOption.getAttribute('data-qty');
  const unitPrice = parseInt(selectedOption.getAttribute('data-price'), 10);
  const totalAmount = unitPrice * quantity;

  // Minimum Order Value Validation (₹200) with Custom Modal Popup
  if (totalAmount < 200) {
    showModal(`Minimum order value for online orders is ₹200. Your current order total is ₹${totalAmount}. Please increase your quantity to proceed.`);
    document.getElementById('customer-qty').focus();
    return;
  }

  // Populate Summary Table Fields
  document.getElementById('summary-contact').innerHTML = `${escapeHtml(name)}<br><small style="color: #555E6C;">${escapeHtml(phone)}</small>`;
  document.getElementById('summary-size-qty').innerHTML = `Size ${sizeLetter} (${pouchQty}) × ${quantity} unit(s)`;
  document.getElementById('summary-address').textContent = address;
  document.getElementById('summary-total').textContent = `₹${totalAmount}`;

  // Reveal summary container smoothly
  const summaryContainer = document.getElementById('summary-container');
  summaryContainer.classList.remove('hidden');
  summaryContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Basic HTML sanitizer for inputs
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Interactive Window Listeners for Order Page
document.addEventListener('DOMContentLoaded', () => {
  // Smooth Header Scroll Disappear / Reveal Handler
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