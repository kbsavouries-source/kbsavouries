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

let productTomSelect = null;
let batchTomSelect = null;

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

    populateFinishedSKUDropdowns();
    populateBatchOptions();
    renderSales();
}

export function populateFinishedSKUDropdowns() {
    const saleProductSelect = document.getElementById('sale-product');
    const finishedSKUs = window.appData.skus.filter(s => s.type === 'Finished Inventory');

    if (saleProductSelect) {
        if (productTomSelect) {
            productTomSelect.destroy();
            productTomSelect = null;
        }

        saleProductSelect.innerHTML = finishedSKUs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

        if (window.TomSelect && finishedSKUs.length > 0) {
            productTomSelect = new TomSelect('#sale-product', {
                create: false,
                sortField: { field: "text", direction: "asc" },
                onChange: () => {
                    onProductChange();
                }
            });
        }

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
        const skuName = productTomSelect ? productTomSelect.getValue() : productSelect.value;
        const sku = window.appData.skus.find(s => s.name === skuName);
        const measure = sku ? (sku.measure || 'Pkts') : 'Pkts';
        qtyLabel.innerText = `Quantity (${measure})`;
    }
}

export function updateProductPrice() {
    const productSelect = document.getElementById('sale-product');
    const priceInput = document.getElementById('sale-price');
    const saleMode = document.getElementById('sale-mode') ? document.getElementById('sale-mode').value : 'Packets';

    if (productSelect && priceInput) {
        const selectedSKUName = productTomSelect ? productTomSelect.getValue() : productSelect.value;
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
    const productSelect = document.getElementById('sale-product');
    const skuName = productTomSelect ? productTomSelect.getValue() : (productSelect ? productSelect.value : '');
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
    const productSelect = document.getElementById('sale-product');
    if (!batchSelect) return;

    const selectedSKUName = productTomSelect ? productTomSelect.getValue() : (productSelect ? productSelect.value : '');
    const selectedProductLine = selectedSKUName.includes(' - ') ? selectedSKUName.split(' - ')[0].trim() : selectedSKUName;

    const matchingBatches = window.appData.batches.filter(b => {
        const hasStock = Number(b.remainingGrams) > 0;
        const matchesProduct = !selectedProductLine || b.product.toLowerCase().includes(selectedProductLine.toLowerCase()) || selectedProductLine.toLowerCase().includes(b.product.toLowerCase());
        return hasStock && matchesProduct;
    });

    if (batchTomSelect) {
        batchTomSelect.destroy();
        batchTomSelect = null;
    }

    if (matchingBatches.length === 0) {
        batchSelect.innerHTML = `<option value="">No Stock Available</option>`;
        if (submitBtn) submitBtn.disabled = true;
    } else {
        batchSelect.innerHTML = matchingBatches.map(b => 
            `<option value="${b.code}">${b.code} (${formatGrams(b.remainingGrams)} left)</option>`
        ).join('');
        if (submitBtn) submitBtn.disabled = false;
    }

    if (window.TomSelect) {
        batchTomSelect = new TomSelect('#sale-batch', {
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }
}

// Auto-generate Sequential Invoice Number (e.g. INV-2026-0001)
function generateInvoiceNumber() {
    let maxNum = 0;
    if (window.appData && window.appData.sales) {
        window.appData.sales.forEach(s => {
            const invNo = s.invoiceNo || '';
            if (invNo.startsWith('INV-')) {
                const parts = invNo.split('-');
                const num = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
    }
    const nextNum = maxNum + 1;
    return `INV-2026-${String(nextNum).padStart(4, '0')}`;
}

export async function addSale(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const productSelect = document.getElementById('sale-product');
    const skuName = productTomSelect ? productTomSelect.getValue() : productSelect.value;
    const batchSelect = document.getElementById('sale-batch');
    const selectedBatchCode = batchTomSelect ? batchTomSelect.getValue() : batchSelect.value;
    const saleMode = document.getElementById('sale-mode').value;
    const skuRecord = window.appData.skus.find(s => s.name === skuName);
    const measure = skuRecord ? (skuRecord.measure || 'Pkts') : 'Pkts';

    if (!selectedBatchCode) {
        alert("Cannot complete sale. No stock available for selected product.");
        return;
    }

    const totalGramsSold = getSaleGrams();
    const batch = window.appData.batches.find(b => b.code === selectedBatchCode);

    if (batch) {
        if (Number(batch.remainingGrams) < totalGramsSold) {
            alert(`Cannot complete sale. Selected batch only has ${formatGrams(batch.remainingGrams)} remaining stock, but this sale requires ${formatGrams(totalGramsSold)}.`);
            return;
        }
        batch.remainingGrams = Number(batch.remainingGrams) - totalGramsSold;
        if (batch.remainingGrams <= 0) {
            batch.remainingGrams = 0;
            batch.status = 'Sold Out';
        }

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
    const invoiceNo = generateInvoiceNumber();

    const sale = {
        invoiceNo: invoiceNo,
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

// --- Invoice Modal Viewer & Printer ---
window.viewInvoiceModal = function(index) {
    const sale = window.appData.sales[index];
    if (!sale) return;

    document.getElementById('inv-modal-number').innerText = sale.invoiceNo || 'INV-2026-0001';
    
    let formattedDate = sale.date;
    const parts = sale.date.split('-');
    if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    document.getElementById('inv-modal-date').innerText = `Date: ${formattedDate}`;

    document.getElementById('inv-modal-customer').innerText = sale.customer;
    document.getElementById('inv-modal-method').innerText = sale.method;

    const tbody = document.getElementById('inv-modal-items');
    tbody.innerHTML = `
        <tr>
            <td style="padding: 12px; font-weight: 700; font-size: 0.9rem;">${sale.product}</td>
            <td style="padding: 12px; font-size: 0.85rem;"><span class="table-code">${sale.batchCode || 'N/A'}</span></td>
            <td style="padding: 12px; font-size: 0.85rem; text-align: center;">${sale.qtyDisplay || '1'}</td>
            <td style="padding: 12px; font-weight: 800; font-size: 0.9rem; text-align: right;">₹${sale.total}</td>
        </tr>
    `;

    document.getElementById('inv-modal-total').innerText = `₹${sale.total}`;
    document.getElementById('invoice-modal').style.display = 'flex';
};

window.closeInvoiceModal = function() {
    document.getElementById('invoice-modal').style.display = 'none';
};

window.printCurrentInvoice = function() {
    window.print();
};
// -------------------------------------

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
        displayedSales = displayedSales.filter(s => s.customer.toLowerCase().includes(searchFilter) || s.product.toLowerCase().includes(searchFilter) || (s.invoiceNo || '').toLowerCase().includes(searchFilter));
    }

    if (dateFilter) {
        displayedSales = displayedSales.filter(s => s.date === dateFilter);
    }

    let totalSalesValue = displayedSales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalValBox = document.getElementById('sales-total-value');
    
    if (totalValBox) totalValBox.innerText = `₹${totalSalesValue}`;

    tbody.innerHTML = displayedSales.map((s) => {
        const realIndex = window.appData.sales.indexOf(s);
        const invNo = s.invoiceNo || `INV-2026-00${realIndex + 1}`;
        return `
            <tr>
                <td data-label="Invoice No."><span class="table-code highlight">${invNo}</span></td>
                <td data-label="Date">${s.date}</td>
                <td data-label="Customer"><strong>${s.customer}</strong></td>
                <td data-label="Product">${s.product}</td>
                <td data-label="Batch Code"><span class="table-code">${s.batchCode || 'N/A'}</span></td>
                <td data-label="Qty">${s.qtyDisplay || `${s.qty} Pkts`}</td>
                <td data-label="Total"><strong>₹${s.total}</strong></td>
                <td data-label="Method">${s.method}</td>
                <td data-label="Action">
                    <div class="action-btn-group">
                        <button class="btn-outline" style="padding: 5px 10px; font-size: 0.78rem; min-height: 32px;" onclick="viewInvoiceModal(${realIndex})">Invoice</button>
                        <button class="btn-danger" style="padding: 5px 10px; font-size: 0.78rem; min-height: 32px;" onclick="deleteSaleItem(${realIndex})">Delete</button>
                    </div>
                </td>
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

window.exportCSV = exportCSV;
window.onProductChange = onProductChange;
window.onSaleModeChange = onSaleModeChange;
window.addSale = addSale;
window.renderSales = renderSales;
window.clearSalesFilters = clearSalesFilters;
window.deleteSaleItem = deleteSaleItem;
window.updateProductPrice = updateProductPrice;
window.viewInvoiceModal = viewInvoiceModal;
window.closeInvoiceModal = closeInvoiceModal;
window.printCurrentInvoice = printCurrentInvoice;

document.addEventListener('DOMContentLoaded', () => {
    initSalesRegister();
});