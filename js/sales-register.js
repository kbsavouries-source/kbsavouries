// ==========================================================================
// Sales Register Module Logic
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
    sales: [],
    batches: [],
    purchases: [],
    samples: []
};

export async function initSalesRegister() {
    const todayStr = new Date().toISOString().split('T')[0];
    const saleDateEl = document.getElementById('sale-date');
    if (saleDateEl) saleDateEl.value = todayStr;

    try {
        const collections = ['skus', 'sales', 'batches'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data:", err);
    }
// Initialize Tom Select on dropdowns for searchability
if (window.TomSelect) {
    new TomSelect('#sale-product', { create: false, sortField: { field: "text", direction: "asc" } });
    new TomSelect('#sale-batch', { create: false, sortField: { field: "text", direction: "asc" } });
}
    populateFinishedSKUDropdowns();
    populateBatchOptions();
    renderSales();
}

export function populateFinishedSKUDropdowns() {
    const saleProductSelect = document.getElementById('sale-product');
    const finishedSKUs = window.appData.skus.filter(s => s.type === 'Finished Inventory');

    if (saleProductSelect) {
        saleProductSelect.innerHTML = finishedSKUs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        updateProductPrice();
    }
}

export function onProductChange() {
    updateProductPrice();
    updateSaleQuantityLabel();
    populateBatchOptions();
}

export function updateSaleQuantityLabel() {
    const productSelect = document.getElementById('sale-product');
    const qtyLabel = document.getElementById('sale-qty-label');
    if (productSelect && qtyLabel) {
        const sku = window.appData.skus.find(s => s.name === productSelect.value);
        const measure = sku ? (sku.measure || 'Pkts') : 'Pkts';
        qtyLabel.innerText = `Quantity (${measure})`;
    }
}

export function updateProductPrice() {
    const productSelect = document.getElementById('sale-product');
    const priceInput = document.getElementById('sale-price');
    const saleMode = document.getElementById('sale-mode') ? document.getElementById('sale-mode').value : 'Packets';

    if (productSelect && priceInput) {
        const selectedSKUName = productSelect.value;
        const matchingSKU = window.appData.skus.find(s => s.name === selectedSKUName);
        if (matchingSKU) {
            if (saleMode === 'Packets') {
                const qty = Number(document.getElementById('sale-qty').value) || 1;
                priceInput.value = matchingSKU.price * qty;
            } else {
                const bulkGrams = getSaleGrams();
                const pricePerGram = matchingSKU.grams > 0 ? (matchingSKU.price / matchingSKU.grams) : 0.4;
                priceInput.value = Math.round(bulkGrams * pricePerGram);
            }
        }
    }
}

export function onSaleModeChange(selectEl) {
    const mode = selectEl.value;
    const qtyGroup = document.getElementById('sale-qty-group');
    const bulkGroup = document.getElementById('sale-bulk-group');

    if (mode === 'Packets') {
        qtyGroup.style.display = 'flex';
        bulkGroup.style.display = 'none';
    } else {
        qtyGroup.style.display = 'none';
        bulkGroup.style.display = 'flex';
    }
    updateProductPrice();
}

export function getSaleGrams() {
    const mode = document.getElementById('sale-mode').value;
    const skuName = document.getElementById('sale-product').value;
    const skuRecord = window.appData.skus.find(s => s.name === skuName);

    if (mode === 'Packets') {
        const units = Number(document.getElementById('sale-qty').value) || 1;
        const singleGrams = skuRecord ? skuRecord.grams : 50;
        return units * singleGrams;
    } else {
        const bulkVal = Number(document.getElementById('sale-bulk-qty').value) || 0;
        const bulkUnit = document.getElementById('sale-bulk-unit').value;
        return bulkUnit === 'Kg' ? bulkVal * 1000 : bulkVal;
    }
}

export function formatGrams(grams) {
    const g = Number(grams) || 0;
    if (Math.abs(g) >= 1000) {
        return `${(g / 1000).toFixed(2)} Kg`;
    }
    return `${g.toFixed(g % 1 === 0 ? 0 : 1)} gms`;
}

export function populateBatchOptions() {
    const batchSelect = document.getElementById('sale-batch');
    const submitBtn = document.getElementById('sale-submit-btn');
    if (!batchSelect) return;

    const matchingBatches = window.appData.batches.filter(b => Number(b.remainingGrams) > 0);

    if (matchingBatches.length === 0) {
        batchSelect.innerHTML = `<option value="">No Stock</option>`;
        if (submitBtn) submitBtn.disabled = true;
    } else {
        batchSelect.innerHTML = matchingBatches.map(b => 
            `<option value="${b.code}">${b.code} (${formatGrams(b.remainingGrams)} left)</option>`
        ).join('');
        if (submitBtn) submitBtn.disabled = false;
    }
}

export async function addSale(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const skuName = document.getElementById('sale-product').value;
    const selectedBatchCode = document.getElementById('sale-batch').value;
    const saleMode = document.getElementById('sale-mode').value;
    const skuRecord = window.appData.skus.find(s => s.name === skuName);
    const measure = skuRecord ? (skuRecord.measure || 'Pkts') : 'Pkts';

    if (!selectedBatchCode) {
        alert("Cannot complete sale. No stock available.");
        return;
    }

    const totalGramsSold = getSaleGrams();
    const batch = window.appData.batches.find(b => b.code === selectedBatchCode);

    if (batch) {
        if (Number(batch.remainingGrams) < totalGramsSold) {
            alert(`Cannot complete sale. Selected batch only has remaining stock, but this sale requires ${formatGrams(totalGramsSold)}.`);
            return;
        }
        batch.remainingGrams = Number(batch.remainingGrams) - totalGramsSold;
        if (batch.remainingGrams <= 0) {
            batch.remainingGrams = 0;
            batch.status = 'Sold Out';
        }

        // Update batch remaining grams in Firestore
        if (batch.firebaseId) {
            try {
                await updateDoc(doc(db, 'batches', batch.firebaseId), {
                    remainingGrams: batch.remainingGrams,
                    status: batch.status
                });
            } catch (err) {
                console.error("Error updating batch stock after sale:", err);
            }
        }
    }

    let qtyDisplayStr = saleMode === 'Packets' ? `${document.getElementById('sale-qty').value} ${measure}` : `${formatGrams(totalGramsSold)}`;

    const sale = {
        date: document.getElementById('sale-date').value,
        customer: document.getElementById('sale-customer').value,
        product: skuName,
        batchCode: selectedBatchCode,
        qtyDisplay: qtyDisplayStr,
        gramsSold: totalGramsSold,
        total: document.getElementById('sale-price').value,
        method: document.getElementById('sale-pay').value
    };

    window.appData.sales.push(sale);
    try {
        await addDoc(collection(db, 'sales'), sale);
    } catch (err) {
        console.error("Error saving sale:", err);
    }

    renderSales();
    populateBatchOptions();
    document.getElementById('sales-form').reset();
    document.getElementById('sale-date').value = todayStr;
    onSaleModeChange(document.getElementById('sale-mode'));
}

export function clearSalesFilters() {
    const searchInput = document.getElementById('sales-search-filter');
    const dateInput = document.getElementById('sales-date-filter');
    if (searchInput) searchInput.value = '';
    if (dateInput) dateInput.value = '';
    renderSales();
}

export function renderSales() {
    const tbody = document.getElementById('sales-table-body');
    if(!tbody) return;
    
    const searchFilter = document.getElementById('sales-search-filter') ? document.getElementById('sales-search-filter').value.toLowerCase().trim() : '';
    const dateFilter = document.getElementById('sales-date-filter') ? document.getElementById('sales-date-filter').value : '';
    
    let displayedSales = window.appData.sales;

    if (searchFilter) {
        displayedSales = displayedSales.filter(s => s.customer.toLowerCase().includes(searchFilter) || s.product.toLowerCase().includes(searchFilter));
    }

    if (dateFilter) {
        displayedSales = displayedSales.filter(s => s.date === dateFilter);
    }

    let totalSalesValue = displayedSales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalValBox = document.getElementById('sales-total-value');
    
    if (totalValBox) totalValBox.innerText = `₹${totalSalesValue}`;

    tbody.innerHTML = displayedSales.map((s) => {
        const realIndex = window.appData.sales.indexOf(s);
        return `
            <tr>
                <td data-label="Date">${s.date}</td>
                <td data-label="Customer">${s.customer}</td>
                <td data-label="Product">${s.product}</td>
                <td data-label="Batch Code"><code>${s.batchCode || 'N/A'}</code></td>
                <td data-label="Qty Sold">${s.qtyDisplay || `${s.qty} Pkts`}</td>
                <td data-label="Total (₹)">₹${s.total}</td>
                <td data-label="Method">${s.method}</td>
                <td data-label="Action"><button class="btn-danger" onclick="deleteSaleItem(${realIndex})">Delete</button></td>
            </tr>
        `;
    }).join('');
}

export async function deleteSaleItem(index) {
    const saleToDelete = window.appData.sales[index];
    
    if (saleToDelete && saleToDelete.batchCode && saleToDelete.batchCode !== 'N/A') {
        const batch = window.appData.batches.find(b => b.code === saleToDelete.batchCode);
        if (batch) {
            const restoredGrams = Number(saleToDelete.gramsSold) || 0;
            batch.remainingGrams = Number(batch.remainingGrams || 0) + restoredGrams;
            batch.status = 'Available';
            if (batch.firebaseId) {
                try {
                    await updateDoc(doc(db, 'batches', batch.firebaseId), {
                        remainingGrams: batch.remainingGrams,
                        status: batch.status
                    });
                } catch (err) {
                    console.error("Error restoring batch stock:", err);
                }
            }
        }
    }

    if (saleToDelete && saleToDelete.firebaseId) {
        try {
            await deleteDoc(doc(db, 'sales', saleToDelete.firebaseId));
        } catch (err) {
            console.error("Error deleting sale:", err);
        }
    }
    window.appData.sales.splice(index, 1);
    renderSales();
    populateBatchOptions();
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

// Add to your window bindings:
window.exportCSV = exportCSV;

// Bind functions to window scope for inline HTML event handling
window.onProductChange = onProductChange;
window.onSaleModeChange = onSaleModeChange;
window.addSale = addSale;
window.renderSales = renderSales;
window.clearSalesFilters = clearSalesFilters;
window.deleteSaleItem = deleteSaleItem;
window.updateProductPrice = updateProductPrice;

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initSalesRegister();
});