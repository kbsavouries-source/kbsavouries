// ==========================================================================
// KB Savouries - Order Management Module Logic (With Notes & PDF Slip)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCullX49Und6AmRgg8UL9hP1cLvQ-KVnEI",
    authDomain: "kb-savouries.firebaseapp.com",
    projectId: "kb-savouries",
    storageBucket: "kb-savouries.firebasestorage.app",
    messagingSenderId: "805966330754",
    appId: "1:805966330754:web:22cf30e2499298e4456d9b"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

window.appData = window.appData || {};
window.appData.orders = [];
window.appData.skus = [];

export async function initOrderMgmt() {
    const todayStr = new Date().toISOString().split('T')[0];
    const orderDateEl = document.getElementById('order-date');
    if (orderDateEl) orderDateEl.value = todayStr;

    try {
        const [ordersSnap, skusSnap] = await Promise.all([
            getDocs(collection(db, 'orders')),
            getDocs(collection(db, 'skus'))
        ]);

        window.appData.orders = ordersSnap.docs.map(docSnap => ({
            firebaseId: docSnap.id,
            id: docSnap.id,
            ...docSnap.data()
        }));

        window.appData.skus = skusSnap.docs.map(docSnap => ({
            firebaseId: docSnap.id,
            ...docSnap.data()
        }));
    } catch (err) {
        console.error("Error loading cloud collections:", err);
    }

    renderOrders();
    
    const container = document.getElementById('order-items-container');
    if (container && container.children.length === 0) {
        window.addOrderLineItem();
    }
}

export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

window.addOrderLineItem = function(productName = '', qty = 1, unitCost = '') {
    const container = document.getElementById('order-items-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'order-item-row';
    row.style.cssText = 'display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.5); padding: 12px; border-radius: 12px; border: 1.5px solid var(--glass-border); flex-wrap: wrap;';

    const finishedSkus = (window.appData.skus || []).filter(s => (s.type || '').toLowerCase().includes('finished'));

    let optionsHTML = `<option value="">Select Finished SKU...</option>`;
    finishedSkus.forEach(s => {
        const selected = (s.name === productName) ? 'selected' : '';
        optionsHTML += `<option value="${s.name}" data-price="${s.price || 0}" ${selected}>${s.name} (₹${s.price || 0})</option>`;
    });

    row.innerHTML = `
        <div style="flex: 3; min-width: 220px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">PRODUCT</label>
            <select class="item-product-select" onchange="onItemProductChange(this)" required>
                ${optionsHTML}
            </select>
        </div>
        <div style="flex: 1; min-width: 90px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">QTY</label>
            <input type="number" class="item-qty" min="1" value="${qty}" oninput="onQtyOrUnitCostChange(this)" style="height: 40px; padding: 6px 12px; border-radius: 8px; border: 1.5px solid var(--glass-border); width: 100%; font-weight: 600;" required>
        </div>
        <div style="flex: 1.2; min-width: 120px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">UNIT COST (₹)</label>
            <input type="number" class="item-unit-cost" min="0" step="0.0001" value="${unitCost !== '' ? unitCost : ''}" placeholder="0.0000" oninput="onQtyOrUnitCostChange(this)" style="height: 40px; padding: 6px 12px; border-radius: 8px; border: 1.5px solid var(--glass-border); width: 100%; font-weight: 600;" required>
        </div>
        <div style="flex: 1.2; min-width: 120px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); display: block; margin-bottom: 4px;">TOTAL (₹)</label>
            <input type="number" class="item-row-total" min="0" step="0.01" placeholder="0.00" oninput="onRowTotalChange(this)" style="height: 40px; padding: 6px 12px; border-radius: 8px; border: 1.5px solid var(--glass-border); width: 100%; font-weight: 700; background: #ffffff;">
        </div>
        <div style="display: flex; align-items: flex-end; padding-top: 18px;">
            <button type="button" class="btn-danger" onclick="removeOrderLineItem(this)" style="padding: 6px 12px; min-height: 40px; width: auto !important;">✕</button>
        </div>
    `;

    container.appendChild(row);

    const selectEl = row.querySelector('.item-product-select');
    if (selectEl && typeof TomSelect !== 'undefined') {
        try {
            new TomSelect(selectEl, {
                create: false,
                sortField: { field: "text", direction: "asc" }
            });
        } catch (err) {
            console.warn("Tom Select init skipped", err);
        }
    }

    if (unitCost !== '') {
        const qtyVal = Number(qty) || 1;
        const totalVal = qtyVal * Number(unitCost);
        row.querySelector('.item-row-total').value = totalVal.toFixed(2);
    }

    calculateOrderGrandTotal();
};

window.removeOrderLineItem = function(btn) {
    const row = btn.closest('.order-item-row');
    if (row) {
        row.remove();
        calculateOrderGrandTotal();
    }
};

window.onItemProductChange = function(selectEl) {
    const row = selectEl.closest('.order-item-row');
    if (!row) return;

    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const price = selectedOption ? selectedOption.getAttribute('data-price') : '';
    
    const unitCostInput = row.querySelector('.item-unit-cost');
    if (unitCostInput && price !== null && price !== '') {
        unitCostInput.value = parseFloat(price).toFixed(4);
    }
    
    window.onQtyOrUnitCostChange(selectEl);
};

window.onQtyOrUnitCostChange = function(inputEl) {
    const row = inputEl.closest('.order-item-row');
    if (!row) return;

    const qty = Number(row.querySelector('.item-qty')?.value) || 0;
    const unitCost = Number(row.querySelector('.item-unit-cost')?.value) || 0;
    const totalInput = row.querySelector('.item-row-total');
    
    if (totalInput) {
        totalInput.value = (qty * unitCost).toFixed(2);
    }
    
    calculateOrderGrandTotal();
};

window.onRowTotalChange = function(totalInputEl) {
    const row = totalInputEl.closest('.order-item-row');
    if (!row) return;

    const qty = Number(row.querySelector('.item-qty')?.value) || 1;
    const total = Number(totalInputEl.value) || 0;
    const unitCostInput = row.querySelector('.item-unit-cost');

    if (unitCostInput && qty > 0) {
        unitCostInput.value = (total / qty).toFixed(4);
    }

    calculateOrderGrandTotal();
};

window.calculateOrderGrandTotal = function() {
    const rows = document.querySelectorAll('#order-items-container .order-item-row');
    let grandTotal = 0;

    rows.forEach(r => {
        const total = Number(r.querySelector('.item-row-total')?.value) || 0;
        grandTotal += total;
    });

    const grandTotalEl = document.getElementById('order-grand-total');
    if (grandTotalEl) {
        grandTotalEl.innerText = `₹${grandTotal.toFixed(2)}`;
    }
};

function getOrderItemsFromDOM() {
    const rows = document.querySelectorAll('#order-items-container .order-item-row');
    const items = [];
    rows.forEach(r => {
        const selectEl = r.querySelector('.item-product-select');
        const productName = selectEl ? selectEl.value.trim() : '';
        const qty = Number(r.querySelector('.item-qty')?.value) || 0;
        const unitCost = Number(r.querySelector('.item-unit-cost')?.value) || 0;
        const totalAmount = Number(r.querySelector('.item-row-total')?.value) || (qty * unitCost);
        
        if (productName) {
            items.push({
                productName,
                qty,
                unitCost: Number(unitCost.toFixed(4)),
                totalAmount: Number(totalAmount.toFixed(2))
            });
        }
    });
    return items;
}

export async function addOrder(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const editIndexEl = document.getElementById('order-edit-index');
    const editIndex = editIndexEl ? editIndexEl.value : '';
    
    const items = getOrderItemsFromDOM();
    if (items.length === 0) {
        alert("Please add at least one product item to the order.");
        return;
    }

    const grandTotal = items.reduce((sum, i) => sum + i.totalAmount, 0);

    const orderData = {
        orderDate: document.getElementById('order-date').value,
        customerName: document.getElementById('customer-name').value.trim(),
        customerPhone: document.getElementById('customer-phone').value.trim(),
        deliveryAddress: document.getElementById('delivery-address').value.trim(),
        notes: document.getElementById('order-notes').value.trim(),
        items: items,
        totalAmount: grandTotal,
        requiredDate: document.getElementById('required-date').value,
        requiredTime: document.getElementById('required-time').value.trim(),
        status: "Pending"
    };

    if (editIndex !== '') {
        const index = Number(editIndex);
        const order = window.appData.orders[index];
        if (!order) return;

        order.orderDate = orderData.orderDate;
        order.customerName = orderData.customerName;
        order.customerPhone = orderData.customerPhone;
        order.deliveryAddress = orderData.deliveryAddress;
        order.notes = orderData.notes;
        order.items = orderData.items;
        order.totalAmount = orderData.totalAmount;
        order.requiredDate = orderData.requiredDate;
        order.requiredTime = orderData.requiredTime;

        renderOrders();
        resetOrderForm();

        const docId = order.firebaseId || order.id;
        if (docId) {
            try {
                await updateDoc(doc(db, 'orders', docId), orderData);
            } catch (err) {
                console.error("Error updating order in cloud:", err);
            }
        }
    } else {
        window.appData.orders.unshift(orderData);
        renderOrders();
        resetOrderForm();

        try {
            const docRef = await addDoc(collection(db, 'orders'), orderData);
            orderData.firebaseId = docRef.id;
            orderData.id = docRef.id;
        } catch (err) {
            console.error("Error saving new order to Firestore:", err);
            alert("Warning: Could not save order to database.");
        }
    }
}

export function editOrder(index) {
    const order = window.appData.orders[index];
    if (!order) return;

    document.getElementById('order-edit-index').value = index;
    document.getElementById('order-date').value = order.orderDate || '';
    document.getElementById('customer-name').value = order.customerName || '';
    document.getElementById('customer-phone').value = order.customerPhone || '';
    document.getElementById('delivery-address').value = order.deliveryAddress || '';
    document.getElementById('order-notes').value = order.notes || '';
    document.getElementById('required-date').value = order.requiredDate || '';
    document.getElementById('required-time').value = order.requiredTime || '';
    
    const container = document.getElementById('order-items-container');
    container.innerHTML = '';
    
    const orderItems = order.items && order.items.length > 0 ? order.items : [{
        productName: order.productName || '',
        qty: order.qty || 1,
        unitCost: order.unitCost || 0
    }];

    orderItems.forEach(i => {
        window.addOrderLineItem(i.productName, i.qty, i.unitCost);
    });

    document.getElementById('order-form-title').innerText = "Edit Customer Order";
    document.getElementById('order-submit-btn').innerText = "Update Order";
    document.getElementById('order-cancel-btn').style.display = "inline-block";

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function openOrderPDFModal(index) {
    const order = window.appData.orders[index];
    if (!order) return;

    document.getElementById('pdf-modal-order-date').innerText = `Date: ${formatDate(order.orderDate)}`;
    document.getElementById('pdf-modal-customer').innerText = order.customerName || 'N/A';
    document.getElementById('pdf-modal-phone').innerText = order.customerPhone || 'N/A';
    document.getElementById('pdf-modal-address').innerText = order.deliveryAddress || 'N/A';
    document.getElementById('pdf-modal-required').innerText = `${formatDate(order.requiredDate)} @ ${order.requiredTime || ''}`;

    const notesWrapper = document.getElementById('pdf-modal-notes-wrapper');
    const notesEl = document.getElementById('pdf-modal-notes');
    if (order.notes && order.notes.trim() !== '') {
        notesEl.innerText = order.notes;
        notesWrapper.style.display = 'block';
    } else {
        notesWrapper.style.display = 'none';
    }

    const statusEl = document.getElementById('pdf-modal-status');
    const isPending = (order.status || 'Pending') === 'Pending';
    statusEl.innerText = (order.status || 'Pending').toUpperCase();
    statusEl.className = `status-badge ${isPending ? 'status-pending' : 'status-completed'}`;

    const itemsArray = order.items && order.items.length > 0 ? order.items : [{
        productName: order.productName || 'N/A',
        qty: order.qty || 0,
        unitCost: order.unitCost || 0,
        totalAmount: order.totalAmount || 0
    }];

    const tbody = document.getElementById('pdf-modal-items');
    tbody.innerHTML = itemsArray.map(item => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 12px; font-weight: 700; font-size: 0.88rem; color: #1e293b;">${item.productName}</td>
            <td style="padding: 10px 12px; font-size: 0.85rem; text-align: center; font-weight: 600;">${item.qty}</td>
            <td style="padding: 10px 12px; font-size: 0.85rem; text-align: right; color: #475569;">₹${Number(item.unitCost).toFixed(4)}</td>
            <td style="padding: 10px 12px; font-weight: 700; font-size: 0.88rem; text-align: right; color: #0f172a;">₹${Number(item.totalAmount || (item.qty * item.unitCost)).toFixed(2)}</td>
        </tr>
    `).join('');

    const grandTotal = order.totalAmount || itemsArray.reduce((sum, i) => sum + (i.qty * i.unitCost), 0);
    document.getElementById('pdf-modal-grand-total').innerText = `₹${Number(grandTotal).toFixed(2)}`;

    document.getElementById('order-pdf-modal').style.display = 'flex';
}

export function closeOrderPDFModal() {
    document.getElementById('order-pdf-modal').style.display = 'none';
}

export function printOrderPDF() {
    window.print();
}

export function cancelOrderEdit() {
    resetOrderForm();
}

function resetOrderForm() {
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('order-form').reset();
    document.getElementById('order-edit-index').value = '';
    document.getElementById('order-date').value = todayStr;
    document.getElementById('order-form-title').innerText = "Create New Customer Order";
    document.getElementById('order-submit-btn').innerText = "Save Order";
    document.getElementById('order-cancel-btn').style.display = "none";
    
    const container = document.getElementById('order-items-container');
    if (container) {
        container.innerHTML = '';
        window.addOrderLineItem();
    }
    calculateOrderGrandTotal();
}

export async function toggleOrderStatus(index) {
    const order = window.appData.orders[index];
    if (!order) return;

    const newStatus = order.status === "Pending" ? "Completed" : "Pending";
    order.status = newStatus;
    
    renderOrders();

    const docId = order.firebaseId || order.id;
    if (docId) {
        try {
            await updateDoc(doc(db, 'orders', docId), { status: newStatus });
        } catch (err) {
            console.error("Error updating order status in cloud:", err);
        }
    }
}

export async function deleteOrder(index) {
    const orderToDelete = window.appData.orders[index];
    if (!orderToDelete) return;

    window.appData.orders.splice(index, 1);
    renderOrders();

    const docId = orderToDelete.firebaseId || orderToDelete.id;
    if (docId) {
        try {
            await deleteDoc(doc(db, 'orders', docId));
        } catch (err) {
            console.error("Error deleting order from Firestore:", err);
        }
    }
}

export function exportOrdersCSV() {
    if (!window.appData.orders || window.appData.orders.length === 0) {
        alert("No orders available to export.");
        return;
    }

    const headers = ["Order Date", "Customer Name", "Mobile No", "Delivery Address", "Special Notes", "Items Summary", "Grand Total (₹)", "Required Date", "Required Time", "Status"];
    const csvRows = [headers.join(",")];

    window.appData.orders.forEach(o => {
        const addressEscaped = `"${(o.deliveryAddress || '').replace(/"/g, '""')}"`;
        const customerEscaped = `"${(o.customerName || '').replace(/"/g, '""')}"`;
        const notesEscaped = `"${(o.notes || '').replace(/"/g, '""')}"`;
        
        const itemsList = (o.items || []).map(i => `${i.productName} (x${i.qty} @ ₹${Number(i.unitCost).toFixed(4)})`).join('; ');
        const itemsEscaped = `"${itemsList.replace(/"/g, '""')}"`;

        const row = [
            o.orderDate || '',
            customerEscaped,
            o.customerPhone || '',
            addressEscaped,
            notesEscaped,
            itemsEscaped,
            o.totalAmount || 0,
            o.requiredDate || '',
            o.requiredTime || '',
            o.status || 'Pending'
        ];
        csvRows.push(row.join(","));
    });

    const csvBlob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `KB_Savouries_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export function renderOrders() {
    const tbody = document.getElementById('order-table-body');
    const filterVal = document.getElementById('status-filter')?.value || 'ALL';
    if (!tbody || !window.appData.orders) return;

    let filtered = window.appData.orders;
    if (filterVal !== 'ALL') {
        filtered = filtered.filter(o => o.status === filterVal);
    }

    tbody.innerHTML = filtered.map((o) => {
        const realIndex = window.appData.orders.indexOf(o);
        const isPending = o.status === 'Pending';
        
        const itemsArray = o.items && o.items.length > 0 ? o.items : [{ productName: o.productName || 'N/A', qty: o.qty || 0, unitCost: o.unitCost || 0 }];
        const grandTotal = o.totalAmount || itemsArray.reduce((sum, i) => sum + (i.qty * i.unitCost), 0);

        return `
            <tr>
                <td data-label="Order Date">${formatDate(o.orderDate)}</td>
                <td data-label="Customer"><strong>${o.customerName}</strong></td>
                <td data-label="Mobile">${o.customerPhone}</td>
                <td data-label="Grand Total"><strong>₹${Number(grandTotal).toFixed(2)}</strong></td>
                <td data-label="Required Date & Time">
                    <span class="required-deadline">
                        ${formatDate(o.requiredDate)} @ ${o.requiredTime}
                    </span>
                </td>
                <td data-label="Status">
                    <span class="status-badge ${isPending ? 'status-pending' : 'status-completed'}">
                        ${o.status}
                    </span>
                </td>
                <td data-label="Action">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn-toggle-status ${isPending ? 'btn-mark-completed' : 'btn-mark-pending'}" 
                                onclick="toggleOrderStatus(${realIndex})">
                            ${isPending ? 'Mark Completed' : 'Mark Pending'}
                        </button>
                        <button class="btn-outline" style="padding: 6px 10px; font-size: 0.78rem;" onclick="editOrder(${realIndex})">Edit</button>
                        <button class="btn-outline" style="padding: 6px 10px; font-size: 0.78rem; background: #3b82f6; color: #fff; border-color: #3b82f6;" onclick="openOrderPDFModal(${realIndex})">PDF</button>
                        <button class="btn-danger" style="padding: 6px 10px; font-size: 0.78rem;" onclick="deleteOrder(${realIndex})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.addOrder = addOrder;
window.editOrder = editOrder;
window.cancelOrderEdit = cancelOrderEdit;
window.toggleOrderStatus = toggleOrderStatus;
window.deleteOrder = deleteOrder;
window.exportOrdersCSV = exportOrdersCSV;
window.addOrderLineItem = addOrderLineItem;
window.removeOrderLineItem = removeOrderLineItem;
window.onItemProductChange = onItemProductChange;
window.onQtyOrUnitCostChange = onQtyOrUnitCostChange;
window.onRowTotalChange = onRowTotalChange;
window.calculateOrderGrandTotal = calculateOrderGrandTotal;
window.renderOrders = renderOrders;
window.openOrderPDFModal = openOrderPDFModal;
window.closeOrderPDFModal = closeOrderPDFModal;
window.printOrderPDF = printOrderPDF;

document.addEventListener('DOMContentLoaded', () => {
    initOrderMgmt();
});