import { STORE_PRODUCTS } from './products-data.js';

const PRODUCTS = STORE_PRODUCTS;

// State tracking active card selections per product (qty starts empty/0)
window.productSelections = {};
PRODUCTS.forEach(p => {
    window.productSelections[p.id] = { sizeIndex: 0, qty: 0 };
});

export function initOrderStorefront() {
    renderProductCards();
}

function renderProductCards() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = PRODUCTS.map((prod) => {
        const sel = window.productSelections[prod.id];
        const selectedSize = prod.sizes[sel.sizeIndex];
        const currentPrice = sel.qty > 0 ? selectedSize.price * sel.qty : 0;
        
        return `
            <div class="card product-inline-card" data-product-id="${prod.id}">
                <div class="product-image-container">
                    <img src="${prod.image}" alt="${prod.name}" class="product-thumb" onerror="this.style.display='none'">
                    <span class="status-badge ${prod.badge === 'POPULAR' ? 'finished' : 'raw'}">${prod.badge}</span>
                </div>

                <div class="product-card-header">
                    <h3>${prod.name}</h3>
                </div>

                <div class="selector-group">
                    <label>SELECT SIZE:</label>
                    <div class="size-pills" id="sizes-${prod.id}">
                        ${prod.sizes.map((s, sIdx) => `
                            <button type="button" class="size-pill ${sIdx === sel.sizeIndex ? 'active' : ''}" 
                                onclick="selectProductSize('${prod.id}',${sIdx})">
                                ${s.weight} - ₹${s.price}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="qty-price-row">
                    <div class="price-display">
                        Price: <strong id="price-${prod.id}">₹${currentPrice}</strong>
                    </div>
                    <div class="qty-stepper">
                        <button type="button" class="btn-outline" onclick="adjustCardQty('${prod.id}', -1)">-</button>
                        <span id="qty-${prod.id}" class="qty-num">${sel.qty > 0 ? sel.qty : ''}</span>
                        <button type="button" class="btn-outline" onclick="adjustCardQty('${prod.id}', 1)">+</button>
                    </div>
                </div>

                <button type="button" class="btn-primary" style="width: 100%; margin-top: 16px;" onclick="addToOrderCart('${prod.id}')">
                    Add / Update Item
                </button>
            </div>
        `;
    }).join('');
}

window.selectProductSize = function(prodId, sIdx) {
    window.productSelections[prodId].sizeIndex = sIdx;
    const prod = PRODUCTS.find(p => p.id === prodId);
    if (!prod) return;

    const pillsContainer = document.getElementById(`sizes-${prodId}`);
    if (pillsContainer) {
        pillsContainer.querySelectorAll('.size-pill').forEach((btn, idx) => {
            btn.classList.toggle('active', idx === sIdx);
        });
    }

    const selectedSize = prod.sizes[sIdx];
    const qty = window.productSelections[prodId].qty;
    const priceEl = document.getElementById(`price-${prodId}`);
    if (priceEl) {
        priceEl.innerText = qty > 0 ? `₹${selectedSize.price * qty}` : `₹0`;
    }
    
    syncAllActiveSelectionsToCart();
};

window.adjustCardQty = function(prodId, change) {
    const sel = window.productSelections[prodId];
    sel.qty = Math.max(0, sel.qty + change);
    
    const qtyEl = document.getElementById(`qty-${prodId}`);
    if (qtyEl) qtyEl.innerText = sel.qty > 0 ? sel.qty : '';

    const prod = PRODUCTS.find(p => p.id === prodId);
    if (!prod) return;
    const selectedSize = prod.sizes[sel.sizeIndex];
    const priceEl = document.getElementById(`price-${prodId}`);
    if (priceEl) {
        priceEl.innerText = sel.qty > 0 ? `₹${selectedSize.price * sel.qty}` : `₹0`;
    }

    syncAllActiveSelectionsToCart();
};

// Allows clearing or setting quantity directly from the live cart review section with live summary refresh
window.updateItemQtyDirect = function(prodId, newQty) {
    const sel = window.productSelections[prodId];
    if (!sel) return;
    sel.qty = Math.max(0, newQty);

    // Refresh card UI
    const qtyEl = document.getElementById(`qty-${prodId}`);
    if (qtyEl) qtyEl.innerText = sel.qty > 0 ? sel.qty : '';

    const prod = PRODUCTS.find(p => p.id === prodId);
    if (prod) {
        const selectedSize = prod.sizes[sel.sizeIndex];
        const priceEl = document.getElementById(`price-${prodId}`);
        if (priceEl) {
            priceEl.innerText = sel.qty > 0 ? `₹${selectedSize.price * sel.qty}` : `₹0`;
        }
    }

    syncAllActiveSelectionsToCart();

    // If order summary is visible, instantly re-evaluate and refresh it
    const summaryCard = document.getElementById('order-summary-card');
    if (summaryCard && summaryCard.style.display !== 'none') {
        const total = calculateCombinedTotal();
        if (total < 200) {
            summaryCard.style.display = 'none';
        } else {
            refreshOrderSummaryDisplay();
        }
    }
};

window.addToOrderCart = function(prodId) {
    syncAllActiveSelectionsToCart();

    const total = calculateCombinedTotal();

    if (total <= 0) {
        showModal(
            "No Items Selected",
            "Please select a quantity for at least one item before proceeding."
        );
        return;
    }

    if (total < 200) {
        const deficit = 200 - total;
        showModal(
            "Minimum Order Value Required",
            `Your combined order total is ₹${total}. Please add ₹${deficit} more in item(s) to meet the ₹200 minimum order requirement.`
        );
        return;
    }

    const checkoutContainer = document.getElementById('checkout-container');
    if (checkoutContainer) {
        checkoutContainer.style.display = 'block';
        const customerInfoCard = document.getElementById('customer-info-card');
        if (customerInfoCard) {
            customerInfoCard.scrollIntoView({ behavior: 'smooth' });
        }
    }

    const summaryCard = document.getElementById('order-summary-card');
    if (summaryCard && summaryCard.style.display !== 'none') {
        refreshOrderSummaryDisplay();
    }
};

function syncAllActiveSelectionsToCart() {
    window.cart = {};
    PRODUCTS.forEach(prod => {
        const sel = window.productSelections[prod.id];
        if (sel && sel.qty > 0) {
            const sizeObj = prod.sizes[sel.sizeIndex];
            window.cart[prod.id] = {
                productId: prod.id,
                name: prod.name,
                sizeLabel: sizeObj.weight,
                unitPrice: sizeObj.price,
                qty: sel.qty
            };
        }
    });

    updateLiveCartReviewDisplay();

    const summaryCard = document.getElementById('order-summary-card');
    if (summaryCard && summaryCard.style.display !== 'none') {
        refreshOrderSummaryDisplay();
    }
}

function updateLiveCartReviewDisplay() {
    const checkoutContainer = document.getElementById('checkout-container');
    const itemsListContainer = document.getElementById('live-cart-items-list');
    const subtotalDisplay = document.getElementById('live-cart-subtotal');
    
    const items = Object.values(window.cart);
    const combinedSubtotal = calculateCombinedTotal();

    if (items.length === 0) {
        if (checkoutContainer) checkoutContainer.style.display = 'none';
        return;
    }

    if (checkoutContainer) checkoutContainer.style.display = 'block';
    if (subtotalDisplay) subtotalDisplay.innerText = `₹${combinedSubtotal}`;

    if (itemsListContainer) {
        itemsListContainer.innerHTML = items.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.7); padding: 10px 14px; border-radius: 12px; border: 1.5px solid rgba(254, 215, 170, 0.6);">
                <div>
                    <strong>${item.name}</strong> (${item.sizeLabel}) × ${item.qty}
                    <div style="color: #EA580C; font-weight: 800; font-size: 0.85rem; margin-top: 2px;">₹${item.unitPrice * item.qty}</div>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    <button type="button" class="btn-outline" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 8px;" onclick="updateItemQtyDirect('${item.productId}', ${item.qty - 1})">-</button>
                    <span style="font-weight: 800; min-width: 18px; text-align: center;">${item.qty}</span>
                    <button type="button" class="btn-outline" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 8px;" onclick="updateItemQtyDirect('${item.productId}', ${item.qty + 1})">+</button>
                    <button type="button" class="btn-outline" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 8px; border-color: #ef4444; color: #ef4444; margin-left: 6px;" onclick="updateItemQtyDirect('${item.productId}', 0)" title="Remove Item">Remove</button>
                </div>
            </div>
        `).join('');
    }
}

function calculateCombinedTotal() {
    return PRODUCTS.reduce((sum, prod) => {
        const sel = window.productSelections[prod.id];
        if (!sel || sel.qty <= 0) return sum;
        const sizeObj = prod.sizes[sel.sizeIndex];
        return sum + (sizeObj.price * sel.qty);
    }, 0);
}

window.generateOrderSummary = function(e) {
    if (e) e.preventDefault();
    refreshOrderSummaryDisplay();
};

function refreshOrderSummaryDisplay() {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();

    if (!name || !phone || !address) {
        showModal("Incomplete Details", "Please fill in your name, phone, and delivery address before generating the order summary.");
        return;
    }

    syncAllActiveSelectionsToCart();
    const items = Object.values(window.cart);
    const combinedSubtotal = calculateCombinedTotal();

    if (combinedSubtotal < 200) {
        showModal("Minimum Order Value", "Minimum online order value is ₹200 across all combined items.");
        return;
    }

    const deliveryCharges = 50;
    const grandTotal = combinedSubtotal + deliveryCharges;

    document.getElementById('sum-cust-info').innerText = `${name} (${phone})`;
    
    const itemsFormatted = items.map(i => `• ${i.name} - Size ${i.sizeLabel} × ${i.qty} unit(s) [₹${i.unitPrice * i.qty}]`).join('<br>');
    document.getElementById('sum-items-list').innerHTML = itemsFormatted;
    document.getElementById('sum-cust-address').innerText = address;

    document.getElementById('sum-subtotal').innerText = `₹${combinedSubtotal}`;
    document.getElementById('sum-grand-total').innerText = `₹${grandTotal}`;

    window.currentOrderData = {
        name,
        phone,
        address,
        items,
        subtotal: combinedSubtotal,
        deliveryCharges,
        grandTotal
    };

    const summaryCard = document.getElementById('order-summary-card');
    if (summaryCard) {
        summaryCard.style.display = 'block';
    }
}

window.sendWhatsAppOrder = function() {
    if (!window.currentOrderData) return;
    const { name, phone, address, items, subtotal, deliveryCharges, grandTotal } = window.currentOrderData;

    let itemsText = items.map(i => `• ${i.name} (${i.sizeLabel}) x ${i.qty} = ₹${i.unitPrice * i.qty}`).join('%0A');

    let msg = `*NEW ORDER - KB SAVOURIES*%0A%0A` +
              `*Customer Name:* ${encodeURIComponent(name)}%0A` +
              `*Phone:* ${encodeURIComponent(phone)}%0A` +
              `*Delivery Address:* ${encodeURIComponent(address)}%0A%0A` +
              `*Order Details:*%0A${itemsText}%0A%0A` +
              `*Items Subtotal:* ₹${subtotal}%0A` +
              `*Delivery Charges:* ₹${deliveryCharges}%0A` +
              `*Grand Total:* ₹${grandTotal}%0A%0A` +
              `_Payment completed via UPI. Receipt screenshot attached._`;

    const whatsappUrl = `https://wa.me/919884049021?text=${msg}`;
    window.open(whatsappUrl, '_blank');
};

function showModal(title, message) {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMsg = document.getElementById('modal-message');
    const btnPrimary = document.getElementById('modal-btn-primary');
    if (!modal) return;

    modalTitle.innerText = title;
    modalMsg.innerText = message;
    btnPrimary.onclick = () => {
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrderStorefront);
} else {
    initOrderStorefront();
}