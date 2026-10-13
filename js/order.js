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

// Update helper text when dropdown selection changes to show centered min quantity callout
function updateFormSelection() {
  const sizeSelect = document.getElementById('selected-size');
  const infoText = document.getElementById('selected-package-info');
  
  if (sizeSelect && infoText) {
    const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
    const price = parseInt(selectedOption.getAttribute('data-price'), 10);
    
    // Calculate minimum quantity required for ₹200 items subtotal
    const minQtyFor200 = Math.ceil(200 / price);

    infoText.innerHTML = `<span id="min-qty-hint" style="color: #16A34A; font-weight: 700; font-size: 1rem;">(Min. Qty for ₹200: ${minQtyFor200} ${minQtyFor200 === 1 ? 'pack' : 'packs'})</span>`;
  
    const qtyInput = document.getElementById('customer-qty');
    if (qtyInput && parseInt(qtyInput.value || 1, 10) < minQtyFor200) {
      qtyInput.value = minQtyFor200;
    }
  }
}

// Custom Modal Popup Handlers with Auto-Scroll to Top
function showModal(message) {
  const modal = document.getElementById('custom-modal');
  const msgEl = document.getElementById('modal-message');
  if (modal && msgEl) {
    msgEl.textContent = message;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
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

// Copy UPI ID to Clipboard Handler
function copyUpi(upiText, btnElement) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(upiText);
  } else {
    // Fallback for non-HTTPS or older environments
    const textArea = document.createElement("textarea");
    textArea.value = upiText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }

  // Visual Feedback (Change icon to checkmark temporarily)
  if (btnElement) {
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    setTimeout(() => {
      btnElement.innerHTML = originalHTML;
    }, 1800);
  }
}

// Calculate and generate order receipt with delivery charge and minimum order validation
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
  
  const itemsTotal = unitPrice * quantity;

  // Minimum Order Value Validation (₹200 items subtotal)
  if (itemsTotal < 200) {
    showModal(`Minimum order value for online orders is ₹200. Your current items total is ₹${itemsTotal}. Please increase your quantity to proceed.`);
    document.getElementById('customer-qty').focus();
    return;
  }

  const deliveryCharge = 50;
  const grandTotal = itemsTotal + deliveryCharge;

  // Populate Receipt Fields
  document.getElementById('summary-contact').innerHTML = `${escapeHtml(name)} (${escapeHtml(phone)})`;
  document.getElementById('summary-size-qty').textContent = `Size ${sizeLetter} (${pouchQty}) × ${quantity} unit(s)`;
  document.getElementById('summary-address').textContent = address;
  
  // Breakdown Values
  document.getElementById('summary-items-subtotal').textContent = `₹${itemsTotal}`;
  document.getElementById('summary-delivery-charge').textContent = `₹${deliveryCharge}`;
  document.getElementById('summary-grand-total').textContent = `₹${grandTotal}`;

  // Dynamically update WhatsApp button pre-filled text
  const whatsappMsg = `Hi! I placed an order on KB Savouries:\n\n*Name:* ${name}\n*Phone:* ${phone}\n*Order:* Size ${sizeLetter} (${pouchQty}) x ${quantity}\n*Items Subtotal:* ₹${itemsTotal}\n*Delivery Charge:* ₹${deliveryCharge}\n*Grand Total:* ₹${grandTotal}\n*Address:* ${address}\n\nI am paying via UPI (kbsavouries@upi / kbsavouries@cnrb). Here are my Order Summary and UPI Payment screenshots:`;
  const whatsappBtn = document.getElementById('whatsapp-link');
  if (whatsappBtn) {
    whatsappBtn.href = `https://wa.me/919884049021?text=${encodeURIComponent(whatsappMsg)}`;
  }

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
  updateFormSelection();

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
    }, {
      threshold: 0.2
    });

    observer.observe(footerContent);
  }
});