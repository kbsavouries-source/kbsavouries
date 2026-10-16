// ==========================================================================
// Purchase Log & PO Conversion Module Logic
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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

window.appData = {
    skus: [],
    purchases: [],
    batches: []
};

export async function initPurchaseLog() {
    const todayStr = new Date().toISOString().split('T')[0];
    const purDateEl = document.getElementById('pur-date');
    if (purDateEl) purDateEl.value = todayStr;

    try {
        const collections = ['skus', 'purchases', 'batches'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for purchases:", err);
    }

    if (!window.appData.purchases) window.appData.purchases = [];

    const container = document.getElementById('purchase-items-container');
    if (container && container.children.length === 0) {
        addPurchaseRow();
    }

    renderPurchases();
}

window.addPurchaseRow = function(itemName = '', qty = '', unit = 'Kg', amt = '') {
    const container = document.getElementById('purchase-items-container');
    if (!container) return;

    const rowId = 'pur-row-' + Date.now() + Math.floor(Math.random() * 1000);
    const rawSKUs = window.appData.skus.filter(s => s.type === 'Raw Material');
    let skuOptions = rawSKUs.map(s => `<option value="${s.name}" ${s.name === itemName ? 'selected' : ''}>${s.name}</option>`).join('');

    const row = document.createElement('div');
    row.className = 'purchase-item-row';
    row.id = rowId;

    row.innerHTML = `
        <div class="form-group row-item-group">
            <label style="font-size:0.75rem;">Raw Material Item</label>
            <select class="row-item" required>
                <option value="">Select Item</option>
                ${skuOptions}
            </select>
        </div>
        <div class="form-group row-qty-group">
            <label style="font-size:0.75rem;">Qty</label>
            <input type="number" class="row-qty" value="${qty}" placeholder="0" step="any" min="0.01" required>
        </div>
        <div class="form-group row-unit-group">
            <label style="font-size:0.75rem;">Unit</label>
            <select class="row-unit" required>
                <option value="Kg" ${unit === 'Kg' ? 'selected' : ''}>Kg</option>
                <option value="Gms" ${unit === 'Gms' ? 'selected' : ''}>Gms</option>
                <option value="Ltrs" ${unit === 'Ltrs' ? 'selected' : ''}>Ltrs</option>
                <option value="ML" ${unit === 'ML' ? 'selected' : ''}>ML</option>
                <option value="Pkts" ${unit === 'Pkts' ? 'selected' : ''}>Pkts</option>
                <option value="Units" ${unit === 'Units' ? 'selected' : ''}>Units</option>
            </select>
        </div>
        <div class="form-group row-amt-group">
            <label style="font-size:0.75rem;">Amount (₹)</label>
            <input type="number" class="row-amt" value="${amt}" placeholder="0" step="any" min="0" oninput="updatePOTotal()" required>
        </div>
        <div class="row-delete-group">
            <button type="button" class="btn-danger" onclick="removePurchaseRow('${rowId}')">✕</button>
        </div>
    `;

    container.appendChild(row);

    const selectEl = row.querySelector('.row-item');
    if (window.TomSelect && selectEl) {
        new TomSelect(selectEl, {
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }

    updatePOTotal();
};

window.removePurchaseRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        updatePOTotal();
    }
};

window.updatePOTotal = function() {
    const rows = document.querySelectorAll('#purchase-items-container .purchase-item-row');
    let total = 0;
    rows.forEach(r => {
        const amt = Number(r.querySelector('.row-amt')?.value) || 0;
        total += amt;
    });

    const display = document.getElementById('form-po-total-display');
    if (display) display.innerText = `₹${total}`;
};

export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function generatePONumber() {
    let maxNum = 0;
    if (window.appData && window.appData.purchases) {
        window.appData.purchases.forEach(p => {
            const poNo = p.poNo || '';
            if (poNo.startsWith('PO-')) {
                const parts = poNo.split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
    }
    const nextNum = maxNum + 1;
    return `PO-2026-${String(nextNum).padStart(4, '0')}`;
}

export async function addPurchaseOrder(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const rows = document.querySelectorAll('#purchase-items-container .purchase-item-row');

    if (rows.length === 0) {
        alert("Please add at least one item row to the purchase order.");
        return;
    }

    let items = [];
    let totalAmount = 0;

    rows.forEach(r => {
        const selectEl = r.querySelector('.row-item');
        const itemName = selectEl.tomselect ? selectEl.tomselect.getValue() : selectEl.value;
        const qty = Number(r.querySelector('.row-qty').value) || 0;
        const unit = r.querySelector('.row-unit').value;
        const amt = Number(r.querySelector('.row-amt').value) || 0;

        items.push({ item: itemName, qty, unit, amt });
        totalAmount += amt;
    });

    const poNo = generatePONumber();
    const purchaseRecord = {
        poNo: poNo,
        date: document.getElementById('pur-date').value,
        vendor: document.getElementById('pur-vendor').value,
        items: items,
        amt: totalAmount,
        status: 'Pending Receipt'
    };

    window.appData.purchases.push(purchaseRecord);
    try {
        const docRef = await addDoc(collection(db, 'purchases'), purchaseRecord);
        purchaseRecord.firebaseId = docRef.id;
    } catch (err) {
        console.error("Error saving purchase order:", err);
    }

    renderPurchases();
    document.getElementById('purchase-form').reset();
    document.getElementById('pur-date').value = todayStr;
    const container = document.getElementById('purchase-items-container');
    if (container) container.innerHTML = '';
    addPurchaseRow();
    updatePOTotal();
}

// Custom Success Notification Helpers
window.showSuccessAlert = function(title, message) {
    const titleEl = document.getElementById('success-alert-title');
    const msgEl = document.getElementById('success-alert-message');
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    const modal = document.getElementById('success-alert-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeSuccessAlert = function() {
    const modal = document.getElementById('success-alert-modal');
    if (modal) modal.style.display = 'none';
};

window.convertPOToReceipt = async function(index) {
    const purchase = window.appData.purchases[index];
    if (!purchase) return;

    if (purchase.status === 'Received') {
        showSuccessAlert("Already Received", "This purchase order has already been converted to a receipt.");
        return;
    }

    purchase.status = 'Received';

    if (purchase.firebaseId) {
        try {
            await updateDoc(doc(db, 'purchases', purchase.firebaseId), {
                status: 'Received'
            });
        } catch (err) {
            console.error("Error updating purchase status in cloud:", err);
        }
    }

    renderPurchases();
    showSuccessAlert(
        "Purchase Received!", 
        `Purchase Order ${purchase.poNo || 'PO'} successfully converted to Received. Inventory Tracker updated.`
    );
};

window.viewPOModal = function(index) {
    const purchase = window.appData.purchases[index];
    if (!purchase) return;

    document.getElementById('po-modal-number').innerText = purchase.poNo || 'PO-2026-0001';
    
    let formattedDate = purchase.date;
    const parts = purchase.date.split('-');
    if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    document.getElementById('po-modal-date').innerText = `Date: ${formattedDate}`;

    document.getElementById('po-modal-vendor').innerText = purchase.vendor;
    const statusEl = document.getElementById('po-modal-status');
    statusEl.innerText = purchase.status || 'Pending Receipt';
    statusEl.style.color = purchase.status === 'Received' ? 'var(--success, #16A34A)' : 'var(--accent-orange, #EA580C)';

    const tbody = document.getElementById('po-modal-items');
    
    let purItems = purchase.items || [{
        item: purchase.item,
        qty: purchase.qty,
        unit: purchase.unit,
        amt: purchase.amt
    }];

    tbody.innerHTML = purItems.map(i => `
        <tr>
            <td style="padding: 10px 12px; font-weight: 700; font-size: 0.9rem;">${i.item}</td>
            <td style="padding: 10px 12px; font-size: 0.85rem; text-align: center;">${i.qty}</td>
            <td style="padding: 10px 12px; font-size: 0.85rem; text-align: right;">${i.unit || 'Kg'}</td>
            <td style="padding: 10px 12px; font-weight: 800; font-size: 0.9rem; text-align: right;">₹${i.amt}</td>
        </tr>
    `).join('');

    document.getElementById('po-modal-total').innerText = `₹${purchase.amt}`;
    document.getElementById('po-modal').style.display = 'flex';
};

window.closePOModal = function() {
    document.getElementById('po-modal').style.display = 'none';
};

window.printCurrentPO = function() {
    window.print();
};

export function clearPurchaseFilters() {
    const searchInput = document.getElementById('pur-search-filter');
    const dateInput = document.getElementById('pur-date-filter');
    if (searchInput) searchInput.value = '';
    if (dateInput) dateInput.value = '';
    renderPurchases();
}

export function renderPurchases() {
    const tbody = document.getElementById('purchase-table-body');
    if(!tbody || !window.appData) return;

    const searchFilter = document.getElementById('pur-search-filter') ? document.getElementById('pur-search-filter').value.toLowerCase().trim() : '';
    const dateFilter = document.getElementById('pur-date-filter') ? document.getElementById('pur-date-filter').value : '';

    let displayedPurchases = window.appData.purchases;

    if (searchFilter) {
        displayedPurchases = displayedPurchases.filter(p => {
            const matchesVendor = (p.vendor || '').toLowerCase().includes(searchFilter);
            const matchesPO = (p.poNo || '').toLowerCase().includes(searchFilter);
            const matchesItem = (p.items || [{item: p.item}]).some(i => (i.item || '').toLowerCase().includes(searchFilter));
            return matchesVendor || matchesPO || matchesItem;
        });
    }

    if (dateFilter) {
        displayedPurchases = displayedPurchases.filter(p => p.date === dateFilter);
    }

    let totalPurchaseValue = displayedPurchases.reduce((sum, p) => sum + Number(p.amt), 0);
    const totalValBox = document.getElementById('purchase-total-value');
    const totalLabel = document.getElementById('purchase-total-label');

    if (totalValBox) totalValBox.innerText = `₹${totalPurchaseValue}`;
    if (totalLabel) {
        if (dateFilter) {
            totalLabel.innerText = `Filtered Outflow (${formatDate(dateFilter)}):`;
        } else if (searchFilter) {
            totalLabel.innerText = `Filtered Outflow ("${searchFilter}"):`;
        } else {
            totalLabel.innerText = 'Total Purchase Outflow:';
        }
    }

    if (displayedPurchases.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 32px;">No matching purchase orders found.</td></tr>`;
        return;
    }

    tbody.innerHTML = displayedPurchases.map((p) => {
        const realIndex = window.appData.purchases.indexOf(p);
        const poNo = p.poNo || `PO-2026-00${realIndex + 1}`;
        const isReceived = p.status === 'Received';

        const statusBadge = isReceived ? 
            `<span class="status-badge received">Received</span>` : 
            `<span class="status-badge pending">Pending</span>`;

        const actionButtons = isReceived ? 
            `<button class="btn-outline po-action-btn" onclick="viewPOModal(${realIndex})">PO PDF</button>
             <button class="btn-danger po-action-btn" onclick="deletePurchaseItem(${realIndex})">Delete</button>` :
            `<button class="btn-primary po-action-btn btn-ok" onclick="convertPOToReceipt(${realIndex})">OK</button>
             <button class="btn-outline po-action-btn" onclick="viewPOModal(${realIndex})">PO</button>
             <button class="btn-danger po-action-btn" onclick="deletePurchaseItem(${realIndex})">Delete</button>`;

        return `
            <tr>
                <td data-label="PO No."><span class="table-code highlight">${poNo}</span></td>
                <td data-label="Date">${formatDate(p.date)}</td>
                <td data-label="Vendor"><strong>${p.vendor || 'N/A'}</strong></td>
                <td data-label="Total Outflow"><strong style="color: var(--accent-orange, #EA580C);">₹${p.amt}</strong></td>
                <td data-label="Status">${statusBadge}</td>
                <td data-label="Action">
                    <div class="po-action-wrapper">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

export async function deletePurchaseItem(index) {
    if (!window.appData) return;
    const purchaseToDelete = window.appData.purchases[index];
    if (purchaseToDelete && purchaseToDelete.firebaseId) {
        try {
            await deleteDoc(doc(db, 'purchases', purchaseToDelete.firebaseId));
        } catch (err) {
            console.error("Error deleting purchase:", err);
        }
    }
    window.appData.purchases.splice(index, 1);
    renderPurchases();
}

export function exportCSV(type) {
    const todayStr = new Date().toISOString().split('T')[0];
    let items = window.appData[type];
    if (!items || items.length === 0) {
        alert("No data available to export in " + type);
        return;
    }
    let keys = Object.keys(items[0]);
    let csvContent = "data:text/csv;charset=utf-8," + keys.join(",") + "\n";
    items.forEach(row => {
        let val = keys.map(k => `"${typeof row[k] === 'object' ? JSON.stringify(row[k]) : (row[k] || '')}"`).join(",");
        csvContent += val + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const linkAnchor = document.createElement("a");
    linkAnchor.setAttribute("href", encodedUri);
    linkAnchor.setAttribute("download", `kb_savouries_${type}_${todayStr}.csv`);
    document.body.appendChild(linkAnchor);
    linkAnchor.click();
    linkAnchor.remove();
}

window.addPurchaseOrder = addPurchaseOrder;
window.addPurchaseRow = addPurchaseRow;
window.removePurchaseRow = removePurchaseRow;
window.updatePOTotal = updatePOTotal;
window.convertPOToReceipt = convertPOToReceipt;
window.renderPurchases = renderPurchases;
window.clearPurchaseFilters = clearPurchaseFilters;
window.deletePurchaseItem = deletePurchaseItem;
window.viewPOModal = viewPOModal;
window.closePOModal = closePOModal;
window.printCurrentPO = printCurrentPO;
window.exportCSV = exportCSV;
window.showSuccessAlert = showSuccessAlert;
window.closeSuccessAlert = closeSuccessAlert;

document.addEventListener('DOMContentLoaded', () => {
    initPurchaseLog();
});