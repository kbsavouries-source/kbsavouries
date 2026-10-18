"use strict";

const MIN_ORDER_VALUE = 200;
const DELIVERY_CHARGE = 50;
const WHATSAPP_NUMBER = "919884049021";

// Prevent duplicate event handling.
let orderEventsInitialized = false;

function getElement(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function calculateMinimumQuantity(price) {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.ceil(MIN_ORDER_VALUE / price);
}

function getSelectedPackage() {
  const select = getElement("selected-size");

  if (!select || !select.value || select.selectedIndex < 0) {
    return null;
  }

  const option = select.options[select.selectedIndex];
  if (!option) return null;

  const price = Number(option.getAttribute("data-price"));

  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    size: select.value,
    pouchQty: option.getAttribute("data-qty") || "",
    price
  };
}

// ---------------- PACKAGE SELECTION ----------------

function selectPackage(size) {
  const select = getElement("selected-size");
  if (!select) return;

  const option = Array.from(select.options).find(
    item => item.value === String(size)
  );

  if (!option) {
    showModal("The selected package could not be found.");
    return;
  }

  select.value = option.value;
  updateFormSelection();

  const section = getElement("order-section");
  if (section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function updateFormSelection() {
  const qtyInput = getElement("customer-qty");
  const infoText = getElement("selected-package-info");

  if (!qtyInput) return;

  const selectedPackage = getSelectedPackage();

  if (!selectedPackage) {
    qtyInput.min = "1";
    qtyInput.removeAttribute("data-min-qty");

    if (infoText) {
      infoText.textContent = "Please select a pouch size.";
    }

    return;
  }

  const minQty = calculateMinimumQuantity(selectedPackage.price);

  qtyInput.min = String(minQty);
  qtyInput.step = "1";
  qtyInput.setAttribute("data-min-qty", String(minQty));
  qtyInput.value = String(minQty);
  qtyInput.setCustomValidity("");

  if (infoText) {
    infoText.textContent =
      `(Min. Qty for ₹${MIN_ORDER_VALUE}: ${minQty} ${
        minQty === 1 ? "pack" : "packs"
      })`;
  }
}

// ---------------- EDIT ORDER ----------------

function editOrder() {
  const summary = getElement("summary-container");
  const section = getElement("order-section");

  if (summary) {
    summary.classList.add("hidden");
  }

  if (section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  const qtyInput = getElement("customer-qty");

  if (qtyInput) {
    window.setTimeout(() => {
      qtyInput.focus();
      qtyInput.select();
    }, 350);
  }
}

// ---------------- MODAL ----------------

function showModal(message) {
  const modal = getElement("custom-modal");
  const messageElement = getElement("modal-message");

  if (modal && messageElement) {
    messageElement.textContent = message;
    modal.classList.remove("hidden");
  } else {
    window.alert(message);
  }
}

function closeModal() {
  const modal = getElement("custom-modal");

  if (modal) {
    modal.classList.add("hidden");
  }
}

// ---------------- COPY UPI ----------------

async function copyUpi(upiText, btnElement) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(String(upiText));
    } else {
      const area = document.createElement("textarea");
      area.value = String(upiText);
      area.style.position = "fixed";
      area.style.opacity = "0";

      document.body.appendChild(area);
      area.select();

      const copied = document.execCommand("copy");
      document.body.removeChild(area);

      if (!copied) throw new Error("Copy failed");
    }

    if (btnElement) {
      const originalHTML = btnElement.innerHTML;
      btnElement.textContent = "Copied!";

      window.setTimeout(() => {
        btnElement.innerHTML = originalHTML;
      }, 1800);
    }
  } catch (error) {
    console.error("UPI copy failed:", error);
    showModal("Unable to copy automatically. Please copy the UPI details manually.");
  }
}

// ---------------- VALIDATE AND REFRESH SUMMARY ----------------

function handleFormSubmit(event) {
  if (event) {
    event.preventDefault();
  }

  const nameInput = getElement("customer-name");
  const phoneInput = getElement("customer-phone");
  const addressInput = getElement("customer-address");
  const sizeSelect = getElement("selected-size");
  const qtyInput = getElement("customer-qty");

  if (
    !nameInput ||
    !phoneInput ||
    !addressInput ||
    !sizeSelect ||
    !qtyInput
  ) {
    showModal("An order form field is missing. Please check your HTML IDs.");
    return false;
  }

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const address = addressInput.value.trim();

  if (!name) {
    showModal("Please enter your name.");
    nameInput.focus();
    return false;
  }

  if (!phone) {
    showModal("Please enter your phone number.");
    phoneInput.focus();
    return false;
  }

  if (address.length < 10) {
    showModal("Please enter a valid address with at least 10 characters.");
    addressInput.focus();
    return false;
  }

  const selectedPackage = getSelectedPackage();

  if (!selectedPackage) {
    showModal("Please select a valid pouch size.");
    sizeSelect.focus();
    return false;
  }

  const { size, pouchQty, price: unitPrice } = selectedPackage;

  const rawQty = qtyInput.value.trim();
  const quantity = Number(rawQty);

  if (
    rawQty === "" ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    showModal("Please enter a valid whole-number quantity.");
    qtyInput.focus();
    return false;
  }

  const minQty = calculateMinimumQuantity(unitPrice);

  qtyInput.min = String(minQty);
  qtyInput.setAttribute("data-min-qty", String(minQty));

  if (quantity < minQty) {
    showModal(
      `Minimum quantity for Size ${size} is ${minQty} packs ` +
      `to meet the ₹${MIN_ORDER_VALUE} minimum order value.`
    );
    qtyInput.focus();
    return false;
  }

  const itemsTotal = unitPrice * quantity;
  const grandTotal = itemsTotal + DELIVERY_CHARGE;

  if (
    !Number.isSafeInteger(itemsTotal) ||
    !Number.isSafeInteger(grandTotal)
  ) {
    showModal("Invalid order total. Please check your quantity.");
    return false;
  }

  const summaryContact = getElement("summary-contact");
  const summarySizeQty = getElement("summary-size-qty");
  const summaryAddress = getElement("summary-address");
  const summarySubtotal = getElement("summary-items-subtotal");
  const summaryDelivery = getElement("summary-delivery-charge");
  const summaryGrandTotal = getElement("summary-grand-total");

  if (
    !summaryContact ||
    !summarySizeQty ||
    !summaryAddress ||
    !summarySubtotal ||
    !summaryDelivery ||
    !summaryGrandTotal
  ) {
    showModal("Summary fields are missing. Check your HTML element IDs.");
    return false;
  }

  summaryContact.textContent = `${name} (${phone})`;
  summarySizeQty.textContent =
    `Size ${size} (${pouchQty}) × ${quantity} unit(s)`;
  summaryAddress.textContent = address;
  summarySubtotal.textContent = `₹${itemsTotal}`;
  summaryDelivery.textContent = `₹${DELIVERY_CHARGE}`;
  summaryGrandTotal.textContent = `₹${grandTotal}`;

  const message =
    `Hi! I placed an order on KB Savouries:\n\n` +
    `*Product:* Poha Crunch\n` +
    `*Name:* ${name}\n` +
    `*Phone:* ${phone}\n` +
    `*Order:* Size ${size} (${pouchQty}) x ${quantity}\n` +
    `*Items Subtotal:* ₹${itemsTotal}\n` +
    `*Delivery Charge:* ₹${DELIVERY_CHARGE}\n` +
    `*Grand Total:* ₹${grandTotal}\n` +
    `*Address:* ${address}\n\n` +
    `I am paying via UPI. Here are my Order Summary and UPI Payment screenshots:`;

  const whatsappBtn = getElement("whatsapp-link");

  if (whatsappBtn) {
    whatsappBtn.href =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  const summary = getElement("summary-container");

  if (summary) {
    summary.classList.remove("hidden");

    summary.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  return false;
}

// ---------------- INITIALIZATION ----------------

document.addEventListener("DOMContentLoaded", () => {
  if (orderEventsInitialized) return;
  orderEventsInitialized = true;

  const sizeSelect = getElement("selected-size");

  if (sizeSelect) {
    sizeSelect.addEventListener("change", updateFormSelection);
  }

  const qtyInput = getElement("customer-qty");
  const form =
    getElement("order-form") ||
    (qtyInput ? qtyInput.closest("form") : null);

  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleFormSubmit(event);
    });
  }

  if (qtyInput) {
    qtyInput.addEventListener("input", () => {
      qtyInput.setCustomValidity("");
    });
  }

  updateFormSelection();
});