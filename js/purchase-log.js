// ==========================================================================
// Purchase Log Module Logic
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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
    purchases: []
};

export async function initPurchaseLog() {
    const todayStr = new Date().toISOString().split('T')[0];
    const purDateEl = document.getElementById('pur-date');
    if (purDateEl) purDateEl.value = todayStr;

    try {
        const collections = ['skus', 'purchases'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for purchases:", err);
    }

    if (!window.appData.purchases) window.appData.purchases = [];

    populateRawMaterialSKUDropdowns();

    // Initialize Tom Select for searchable dropdown
    if (window.TomSelect) {
        new TomSelect('#pur-item', { 
            create: false, 
            sortField: { field: "text", direction: "asc" } 
        });
    }

    renderPurchases();
}

export function populateRawMaterialSKUDropdowns() {
    const purItemSelect = document.getElementById('pur-item');
    const rawSKUs = window.appData.skus.filter(s => s.type === 'Raw Material');

    if (purItemSelect) {
        purItemSelect.innerHTML = rawSKUs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    }
}

export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

export async function addPurchase(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    
    const pur = {
        date: document.getElementById('pur-date').value,
        vendor: document.getElementById('pur-vendor').value,
        item: document.getElementById('pur-item').value,
        qty: document.getElementById('pur-qty').value,
        unit: document.getElementById('pur-unit').value,
        amt: document.getElementById('pur-amt').value
    };

    window.appData.purchases.push(pur);
    try {
        await addDoc(collection(db, 'purchases'), pur);
    } catch (err) {
        console.error("Error saving purchase:", err);
    }

    renderPurchases();
    document.getElementById('purchase-form').reset();
    document.getElementById('pur-date').value = todayStr;
}

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
        displayedPurchases = displayedPurchases.filter(p => p.item.toLowerCase().includes(searchFilter) || p.vendor.toLowerCase().includes(searchFilter));
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

    tbody.innerHTML = displayedPurchases.map((p) => {
        const realIndex = window.appData.purchases.indexOf(p);
        return `
            <tr>
                <td data-label="Date">${formatDate(p.date)}</td>
                <td data-label="Vendor">${p.vendor}</td>
                <td data-label="Item">${p.item}</td>
                <td data-label="Qty & Unit">${p.qty} ${p.unit || 'Kg'}</td>
                <td data-label="Total Amt (₹)">₹${p.amt}</td>
                <td data-label="Action"><button class="btn-danger" onclick="deletePurchaseItem(${realIndex})">Delete</button></td>
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
        let val = keys.map(k => `"${row[k] || ''}"`).join(",");
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

// Bind functions to window scope for inline HTML event handling
window.addPurchase = addPurchase;
window.renderPurchases = renderPurchases;
window.clearPurchaseFilters = clearPurchaseFilters;
window.deletePurchaseItem = deletePurchaseItem;
window.exportCSV = exportCSV;

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initPurchaseLog();
});