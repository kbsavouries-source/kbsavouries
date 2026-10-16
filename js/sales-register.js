// ==========================================================================
// Sales Register Module Logic (Multi-Product Invoice Support)
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

    const container = document.getElementById('sale-items-container');
    if (container && container.children.length === 0) {
        addSaleLineItem();
    }

    renderSales();
}

window.addSaleLineItem = function() {
    const container = document.getElementById('sale-items-container');
    if (!container) return;

    const rowId = 'sale-row-' + Date.now() + Math.floor(Math.random() * 1000);
    const finishedSKUs = window.appData.skus.filter(s => s.type === 'Finished Inventory');
    let productOptions = finishedSKUs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

    const row = document.createElement('div');
    row.className = 'sale-item-row';
    row.id = rowId;

    row.innerHTML = `
        <div class="form-group row-product-group">
            <label style="font-size:0.75rem;">Product / SKU</label>
            <select class="row-product" onchange="onRowProductChange('${rowId}')" required>
                <option value="">Select SKU</option>
                ${productOptions}
            </select>
        </div>
        <div class="form-group row-batch-group">
            <label style="font-size:0.75rem;">Batch Code</label>
            <select class="row-batch" required>
                <option value="">No Stock</option>
            </select>
        </div>
        <div class="form-group row-qty-group">
            <label style="font-size:0.75rem;">Qty (Pkts/Units)</label>
            <input type="number" class="row-qty" value="1" min="1" step="any" oninput="updateRowTotal('${rowId}')" required>
        </div>
        <div class="form-group row-price-group">
            <label style="font-size:0.75rem;">Price (₹)</label>
            <input type="number" class="row-price" placeholder="0" min="0" step="any" oninput="updateFormTotal()" required>
        </div>
        <div class="row-delete-group">
            <button type="button" class="btn-danger" onclick="removeSaleLineItem('${rowId}')">✕</button>
        </div>
    `;

    container.appendChild(row);

    const productSelect = row.querySelector('.row-product');
    if (window.TomSelect && productSelect) {
        new TomSelect(productSelect, {
            create: false,
            sortField: { field: "text", direction: "asc" },
            onChange: () => {
                onRowProductChange(rowId);
            }
        });
    }

    onRowProductChange(rowId);
};

window.removeSaleLineItem = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        updateFormTotal();
    }
};

window.onRowProductChange = function(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const productSelect = row.querySelector('.row-product');
    const skuName = productSelect.tomselect ? productSelect.tomselect.getValue() : productSelect.value;
    
    const batchSelect = row.querySelector('.row-batch');
    const selectedProductLine = skuName.includes(' - ') ? skuName.split(' - ')[0].trim() : skuName;

    const matchingBatches = window.appData.batches.filter(b => {
        const hasStock = Number(b.remainingGrams) > 0;
        const matchesProduct = !selectedProductLine || b.product.toLowerCase().includes(selectedProductLine.toLowerCase()) || selectedProductLine.toLowerCase().includes(b.product.toLowerCase());
        return hasStock && matchesProduct;
    });

    if (batchSelect.tomselect) {
        batchSelect.tomselect.destroy();
    }

    if (matchingBatches.length === 0) {
        batchSelect.innerHTML = `<option value="">No Stock Available</option>`;
    } else {
        batchSelect.innerHTML = matchingBatches.map(b => 
            `<option value="${b.code}">${b.code} (${formatGrams(b.remainingGrams)} left)</option>`
        ).join('');
    }

    if (window.TomSelect) {
        new TomSelect(batchSelect, {
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }

    updateRowTotal(rowId);
};

window.updateRowTotal = function(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const productSelect = row.querySelector('.row-product');
    const skuName = productSelect.tomselect ? productSelect.tomselect.getValue() : productSelect.value;
    const matchingSKU = window.appData.skus.find(s => s.name === skuName);
    const qty = Number(row.querySelector('.row-qty').value) || 0;
    const priceInput = row.querySelector('.row-price');

    if (matchingSKU && priceInput) {
        priceInput.value = matchingSKU.price * qty;
    }

    updateFormTotal();
};

window.updateFormTotal = function() {
    const rows = document.querySelectorAll('#sale-items-container .sale-item-row');
    let total = 0;
    rows.forEach(r => {
        const price = Number(r.querySelector('.row-price')?.value) || 0;
        total += price;
    });

    const display = document.getElementById('form-total-display');
    if (display) display.innerText = `₹${total}`;
};

export function formatGrams(grams) {
    const g = Number(grams) || 0;
    if (Math.abs(g) >= 1000) {
        return `${(g / 1000).toFixed(2)} Kg`;
    }
    return `${g.toFixed(g % 1 === 0 ? 0 : 1)} gms`;
}

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
    const rows = document.querySelectorAll('#sale-items-container .sale-item-row');

    if (rows.length === 0) {
        alert("Please add at least one product row to the sale.");
        return;
    }

    let items = [];
    let totalInvoiceAmount = 0;

    for (let r of rows) {
        const productSelect = r.querySelector('.row-product');
        const skuName = productSelect.tomselect ? productSelect.tomselect.getValue() : productSelect.value;
        const batchSelect = r.querySelector('.row-batch');
        const batchCode = batchSelect.tomselect ? batchSelect.tomselect.getValue() : batchSelect.value;
        const qty = Number(r.querySelector('.row-qty').value) || 1;
        const lineTotal = Number(r.querySelector('.row-price').value) || 0;

        if (!skuName || !batchCode) {
            alert("Please select a product and batch code for all rows.");
            return;
        }

        const skuRecord = window.appData.skus.find(s => s.name === skuName);
        const measure = skuRecord ? (skuRecord.measure || 'Pkts') : 'Pkts';
        const singleGrams = skuRecord ? skuRecord.grams : 50;
        const totalGramsSold = qty * singleGrams;

        const batch = window.appData.batches.find(b => b.code === batchCode);
        if (batch) {
            if (Number(batch.remainingGrams) < totalGramsSold) {
                alert(`Cannot complete sale. Batch ${batchCode} only has ${formatGrams(batch.remainingGrams)} remaining stock, but this row requires ${formatGrams(totalGramsSold)}.`);
                return;
            }
        }

        items.push({
            product: skuName,
            batchCode: batchCode,
            qtyDisplay: `${qty} ${measure}`,
            gramsSold: totalGramsSold,
            total: lineTotal
        });

        totalInvoiceAmount += lineTotal;
    }

    for (let item of items) {
        const batch = window.appData.batches.find(b => b.code === item.batchCode);
        if (batch) {
            batch.remainingGrams = Number(batch.remainingGrams) - item.gramsSold;
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
    }

    const invoiceNo = generateInvoiceNumber();

    const saleRecord = {
        invoiceNo: invoiceNo,
        date: document.getElementById('sale-date').value,
        customer: document.getElementById('sale-customer').value,
        items: items,
        total: totalInvoiceAmount,
        method: document.getElementById('sale-pay').value
    };

    window.appData.sales.push(saleRecord);
    try {
        await addDoc(collection(db, 'sales'), saleRecord);
    } catch (err) {
        console.error("Error saving sale:", err);
    }

    renderSales();
    document.getElementById('sales-form').reset();
    document.getElementById('sale-date').value = todayStr;
    const container = document.getElementById('sale-items-container');
    if (container) container.innerHTML = '';
    addSaleLineItem();
    updateFormTotal();
}

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
    
    let saleItems = sale.items || [{
        product: sale.product,
        batchCode: sale.batchCode,
        qtyDisplay: sale.qtyDisplay || '1 Pkts',
        total: sale.total
    }];

    tbody.innerHTML = saleItems.map(item => `
        <tr>
            <td style="padding: 10px 12px; font-weight: 700; font-size: 0.9rem;">${item.product}</td>
            <td style="padding: 10px 12px; font-size: 0.85rem;"><span class="table-code">${item.batchCode || 'N/A'}</span></td>
            <td style="padding: 10px 12px; font-size: 0.85rem; text-align: center;">${item.qtyDisplay}</td>
            <td style="padding: 10px 12px; font-weight: 800; font-size: 0.9rem; text-align: right;">₹${item.total}</td>
        </tr>
    `).join('');

    document.getElementById('inv-modal-total').innerText = `₹${sale.total}`;
    document.getElementById('invoice-modal').style.display = 'flex';
};

window.closeInvoiceModal = function() {
    document.getElementById('invoice-modal').style.display = 'none';
};

window.printCurrentInvoice = function() {
    window.print();
};

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
        displayedSales = displayedSales.filter(s => {
            const matchesCustomer = (s.customer || '').toLowerCase().includes(searchFilter);
            const matchesInvoice = (s.invoiceNo || '').toLowerCase().includes(searchFilter);
            const matchesProduct = (s.items || [{product: s.product}]).some(i => (i.product || '').toLowerCase().includes(searchFilter));
            return matchesCustomer || matchesInvoice || matchesProduct;
        });
    }

    if (dateFilter) {
        displayedSales = displayedSales.filter(s => s.date === dateFilter);
    }

    let totalSalesValue = displayedSales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalValBox = document.getElementById('sales-total-value');
    
    if (totalValBox) totalValBox.innerText = `₹${totalSalesValue}`;

    if (displayedSales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 32px;">No matching sales records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = displayedSales.map((s) => {
        const realIndex = window.appData.sales.indexOf(s);
        const invNo = s.invoiceNo || `INV-2026-00${realIndex + 1}`;

        return `
            <tr>
                <td data-label="Invoice No."><span class="table-code highlight">${invNo}</span></td>
                <td data-label="Date">${s.date}</td>
                <td data-label="Customer"><strong>${s.customer}</strong></td>
                <td data-label="Total"><strong style="color: var(--accent-orange, #EA580C);">₹${s.total}</strong></td>
                <td data-label="Method">${s.method}</td>
                <td data-label="Action">
                    <div class="sales-action-wrapper">
                        <button class="btn-outline sale-action-btn" onclick="viewInvoiceModal(${realIndex})">Invoice</button>
                        <button class="btn-danger sale-action-btn" onclick="deleteSaleItem(${realIndex})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

export async function deleteSaleItem(index) {
    const saleToDelete = window.appData.sales[index];
    
    if (saleToDelete) {
        let saleItems = saleToDelete.items || [{
            batchCode: saleToDelete.batchCode,
            gramsSold: saleToDelete.gramsSold
        }];

        for (let item of saleItems) {
            if (item.batchCode && item.batchCode !== 'N/A') {
                const batch = window.appData.batches.find(b => b.code === item.batchCode);
                if (batch) {
                    const restoredGrams = Number(item.gramsSold) || 0;
                    const currentRemaining = Number(batch.remainingGrams) || 0;
                    const maxAllowedGrams = Number(batch.totalGrams || batch.weightGrams || batch.outputGrams) || (currentRemaining + restoredGrams);

                    let newRemaining = currentRemaining + restoredGrams;
                    if (maxAllowedGrams > 0 && newRemaining > maxAllowedGrams) {
                        newRemaining = maxAllowedGrams;
                    }

                    batch.remainingGrams = newRemaining;
                    batch.status = batch.remainingGrams > 0 ? 'Available' : 'Sold Out';

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

window.exportCSV = exportCSV;
window.addSale = addSale;
window.renderSales = renderSales;
window.clearSalesFilters = clearSalesFilters;
window.deleteSaleItem = deleteSaleItem;
window.viewInvoiceModal = viewInvoiceModal;
window.closeInvoiceModal = closeInvoiceModal;
window.printCurrentInvoice = printCurrentInvoice;

document.addEventListener('DOMContentLoaded', () => {
    initSalesRegister();
});