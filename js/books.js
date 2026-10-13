// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCullX49Und6AmRgg8UL9hP1cLvQ-KVnEI",
    authDomain: "kb-savouries.firebaseapp.com",
    projectId: "kb-savouries",
    storageBucket: "kb-savouries.firebasestorage.app",
    messagingSenderId: "805966330754",
    appId: "1:805966330754:web:22cf30e2499298e4456d9b"
};

// Initialize Firebase & Firestore
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

let appData = {
    skus: [],
    sales: [],
    batches: [],
    purchases: [],
    samples: []
};

// Default initial SKUs seeded if collection is empty
const defaultSKUs = [
    { name: "Poha Crunch - 30g", type: "Finished Inventory", grams: 30, price: 15, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 50g", type: "Finished Inventory", grams: 50, price: 25, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 250g", type: "Finished Inventory", grams: 250, price: 110, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 500g", type: "Finished Inventory", grams: 500, price: 210, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 1 Kg", type: "Finished Inventory", grams: 1000, price: 400, measure: "Pkts", unit: "Pkts" },
    { name: "Poha", type: "Raw Material", grams: 0, price: 0, unit: "Kg" },
    { name: "Peanut", type: "Raw Material", grams: 0, price: 0, unit: "Kg" },
    { name: "Roasted Channa", type: "Raw Material", grams: 0, price: 0, unit: "Kg" },
    { name: "Rice Bran Oil", type: "Raw Material", grams: 0, price: 0, unit: "Ltrs" },
    { name: "Curry Leaves", type: "Raw Material", grams: 0, price: 0, unit: "Gms" },
    { name: "Turmeric", type: "Raw Material", grams: 0, price: 0, unit: "Gms" },
    { name: "Chilli Powder", type: "Raw Material", grams: 0, price: 0, unit: "Gms" },
    { name: "Salt", type: "Raw Material", grams: 0, price: 0, unit: "Kg" }
];

// Universal Recipe BOM proportions per 500g output (extensible for any product line)
const defaultRecipePer500g = {
    "Poha": { qty: 250, unit: "gms", category: "Raw Food Ingredient" },
    "Peanut": { qty: 63, unit: "gms", category: "Raw Food Ingredient" },
    "Roasted Channa": { qty: 63, unit: "gms", category: "Raw Food Ingredient" },
    "Rice Bran Oil": { qty: 500, unit: "ml", category: "Raw Food Ingredient" },
    "Curry Leaves": { qty: 10, unit: "gms", category: "Raw Food Ingredient" },
    "Turmeric": { qty: 5, unit: "gms", category: "Raw Food Ingredient" },
    "Chilli Powder": { qty: 1.5, unit: "gms", category: "Raw Food Ingredient" },
    "Salt": { qty: 1.5, unit: "gms", category: "Raw Food Ingredient" }
};

function normalizeIngredientName(rawName) {
    if (!rawName) return "Other";
    let name = rawName.trim();
    let lower = name.toLowerCase();

    if (lower.includes("peanut") || lower.includes("groundnut")) return "Peanut";
    if (lower.includes("oil") || lower.includes("bran")) return "Rice Bran Oil";
    if (lower.includes("poha")) return "Poha";
    if (lower.includes("channa") || lower.includes("gram")) return "Roasted Channa";
    if (lower.includes("curry")) return "Curry Leaves";
    if (lower.includes("turmeric") || lower.includes("manjal")) return "Turmeric";
    if (lower.includes("chilli") || lower.includes("chili")) return "Chilli Powder";
    if (lower.includes("salt")) return "Salt";
    
    return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function formatDynamicValue(val, preferredUnit) {
    const v = Number(val) || 0;
    const unit = (preferredUnit || '').toLowerCase();

    if (unit === 'kg' || unit === 'gms') {
        if (Math.abs(v) >= 1000) {
            return `${(v / 1000).toFixed(2)} Kg`;
        }
        return `${v.toFixed(v % 1 === 0 ? 0 : 1)} gms`;
    }
    if (unit === 'ltrs' || unit === 'ml') {
        if (Math.abs(v) >= 1000) {
            return `${(v / 1000).toFixed(2)} Ltrs`;
        }
        return `${v.toFixed(0)} ML`;
    }
    return `${v.toFixed(v % 1 === 0 ? 0 : 1)} ${preferredUnit || 'Units'}`;
}

function formatGrams(grams) {
    const g = Number(grams) || 0;
    if (Math.abs(g) >= 1000) {
        return `${(g / 1000).toFixed(2)} Kg`;
    }
    return `${g.toFixed(g % 1 === 0 ? 0 : 1)} gms`;
}

window.verifyPasscode = function(e) {
    e.preventDefault();
    const inputVal = document.getElementById('passcode-input').value;
    const errorDiv = document.getElementById('passcode-error');
    
    if (inputVal === '1998') {
        sessionStorage.setItem('kb_authenticated', 'true');
        document.getElementById('passcode-modal').style.display = 'none';
    } else {
        errorDiv.innerText = 'Incorrect passcode. Please try again.';
        document.getElementById('passcode-input').value = '';
        document.getElementById('passcode-input').focus();
    }
}

async function loadCloudData() {
    try {
        const collections = ['skus', 'sales', 'batches', 'purchases', 'samples'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }

        if (appData.skus.length === 0) {
            for (let sku of defaultSKUs) {
                const docRef = await addDoc(collection(db, 'skus'), sku);
                sku.firebaseId = docRef.id;
                appData.skus.push(sku);
            }
        }
    } catch (err) {
        console.error("Error loading cloud data:", err);
        appData = JSON.parse(localStorage.getItem('kb_savouries_data')) || { skus: defaultSKUs, sales: [], batches: [], purchases: [], samples: [] };
    }

    if (!appData.samples) appData.samples = [];

    refreshDynamicDropdowns();
    renderSKUs();
    renderSales();
    renderBatches();
    renderPurchases();
    renderSamples();
    renderInventory();
    updateDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('kb_authenticated') === 'true') {
        const modal = document.getElementById('passcode-modal');
        if (modal) modal.style.display = 'none';
    }

    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const todayStr = new Date().toISOString().split('T')[0];
    ['sale-date', 'batch-date', 'pur-date', 'sample-date'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = todayStr;
    });

    loadCloudData();
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

function switchTab(tabId, event) {
    const finishedSKUs = appData.skus.filter(s => s.type === 'Finished Inventory');
    const rawSKUs = appData.skus.filter(s => s.type === 'Raw Material');

    if (tabId !== 'dashboard' && tabId !== 'skus' && (finishedSKUs.length === 0 || rawSKUs.length === 0)) {
        alert("Please create at least one 'Finished Inventory' SKU and one 'Raw Material' SKU in the SKU Catalog before accessing operations.");
        switchTab('skus', { currentTarget: document.querySelector('.nav-links li:nth-child(2)') });
        return;
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    document.getElementById('page-title').innerText = event.currentTarget.innerText;

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

async function saveData(collectionName, dataObj) {
    try {
        const docRef = await addDoc(collection(db, collectionName), dataObj);
        dataObj.firebaseId = docRef.id;
    } catch (e) {
        console.error("Error writing to Firestore: ", e);
    }
    updateDashboard();
    renderInventory();
    refreshDynamicDropdowns();
}

async function deleteDataDoc(collectionName, firebaseId) {
    try {
        if (firebaseId) {
            await deleteDoc(doc(db, collectionName, firebaseId));
        }
    } catch (e) {
        console.error("Error deleting from Firestore: ", e);
    }
}

function updateDashboard() {
    let totalRev = appData.sales.reduce((sum, item) => sum + Number(item.total), 0);
    document.getElementById('stat-revenue').innerText = `₹${totalRev}`;
    document.getElementById('stat-orders').innerText = appData.sales.length;
    
    let activeBatches = appData.batches.filter(b => Number(b.remainingGrams) > 0).length;
    document.getElementById('stat-batches').innerText = activeBatches;
}

// --- SKU Management Functions ---
function onSKUTypeChange(selectEl) {
    const type = selectEl.value;
    const gramsGroup = document.getElementById('sku-grams-group');
    const priceGroup = document.getElementById('sku-price-group');
    const measureGroup = document.getElementById('sku-measure-group');
    const unitGroup = document.getElementById('sku-unit-group');

    if (type === 'Finished Inventory') {
        gramsGroup.style.display = 'flex';
        priceGroup.style.display = 'flex';
        measureGroup.style.display = 'flex';
        unitGroup.style.display = 'none';
    } else {
        gramsGroup.style.display = 'none';
        priceGroup.style.display = 'none';
        measureGroup.style.display = 'none';
        unitGroup.style.display = 'flex';
    }
}

async function addSKU(e) {
    e.preventDefault();
    const editIndex = document.getElementById('sku-edit-index').value;
    const name = document.getElementById('sku-name').value.trim();
    const type = document.getElementById('sku-type').value;

    if (editIndex === "") {
        if (appData.skus.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            alert("An SKU with this name already exists.");
            return;
        }
    }

    const skuObj = {
        name: name,
        type: type,
        grams: type === 'Finished Inventory' ? Number(document.getElementById('sku-grams').value) || 0 : 0,
        price: type === 'Finished Inventory' ? Number(document.getElementById('sku-price').value) || 0 : 0,
        measure: type === 'Finished Inventory' ? document.getElementById('sku-measure').value : 'Pkts',
        unit: type === 'Raw Material' ? document.getElementById('sku-unit').value : 'Pkts'
    };

    if (editIndex !== "") {
        // Edit existing
        const index = Number(editIndex);
        skuObj.firebaseId = appData.skus[index].firebaseId;
        appData.skus[index] = skuObj;

        if (skuObj.firebaseId) {
            try {
                await updateDoc(doc(db, 'skus', skuObj.firebaseId), {
                    name: skuObj.name,
                    type: skuObj.type,
                    grams: skuObj.grams,
                    price: skuObj.price,
                    measure: skuObj.measure,
                    unit: skuObj.unit
                });
            } catch (err) {
                console.error("Error updating SKU in Firestore:", err);
            }
        }
        cancelSKUEdit();
    } else {
        // Create new
        appData.skus.push(skuObj);
        await saveData('skus', skuObj);
        document.getElementById('sku-form').reset();
        onSKUTypeChange(document.getElementById('sku-type'));
    }

    renderSKUs();
    refreshDynamicDropdowns();
}

function editSKUItem(index) {
    const sku = appData.skus[index];
    if (!sku) return;

    document.getElementById('sku-edit-index').value = index;
    document.getElementById('sku-name').value = sku.name;
    document.getElementById('sku-type').value = sku.type;
    onSKUTypeChange(document.getElementById('sku-type'));

    if (sku.type === 'Finished Inventory') {
        document.getElementById('sku-grams').value = sku.grams;
        document.getElementById('sku-price').value = sku.price;
        document.getElementById('sku-measure').value = sku.measure || 'Pkts';
    } else {
        document.getElementById('sku-unit').value = sku.unit || 'Kg';
    }

    document.getElementById('sku-form-title').innerText = `Edit SKU: ${sku.name}`;
    document.getElementById('sku-submit-btn').innerText = 'Update SKU';
    document.getElementById('sku-cancel-btn').style.display = 'inline-flex';

    document.getElementById('sku-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelSKUEdit() {
    document.getElementById('sku-edit-index').value = '';
    document.getElementById('sku-form').reset();
    onSKUTypeChange(document.getElementById('sku-type'));
    document.getElementById('sku-form-title').innerText = 'Create New SKU (Raw Material or Finished Inventory)';
    document.getElementById('sku-submit-btn').innerText = 'Register SKU';
    document.getElementById('sku-cancel-btn').style.display = 'none';
}

function renderSKUs() {
    const tbody = document.getElementById('sku-table-body');
    if (!tbody) return;

    const sortedSKUs = [...appData.skus].sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'Finished Inventory' ? -1 : 1;
    });

    tbody.innerHTML = sortedSKUs.map((s) => {
        const index = appData.skus.indexOf(s);
        let details = s.type === 'Finished Inventory' ? `${s.grams}g equivalent (${s.measure || 'Pkts'})` : `Preferred Unit: ${s.unit}`;
        let pricing = s.type === 'Finished Inventory' ? `₹${s.price}` : `N/A (Raw Material)`;
        return `
            <tr>
                <td data-label="SKU Name"><strong>${s.name}</strong></td>
                <td data-label="Classification"><span class="status-badge" style="background: ${s.type === 'Finished Inventory' ? '#dcfce7' : '#e0f2fe'}; color: ${s.type === 'Finished Inventory' ? '#15803d' : '#0369a1'};">${s.type}</span></td>
                <td data-label="Details / Specs">${details}</td>
                <td data-label="Price / Unit">${pricing}</td>
                <td data-label="Action" style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-outline" style="padding: 6px 12px; font-size: 0.8rem; min-height: 36px;" onclick="editSKUItem(${index})">Edit</button>
                    <button class="btn-danger" onclick="deleteSKUItem(${index})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function deleteSKUItem(index) {
    const skuToDelete = appData.skus[index];
    await deleteDataDoc('skus', skuToDelete.firebaseId);
    appData.skus.splice(index, 1);
    renderSKUs();
    refreshDynamicDropdowns();
}

function refreshDynamicDropdowns() {
    populateFinishedSKUDropdowns();
    populateRawMaterialSKUDropdowns();
    populateBatchOptions();
    populateSampleBatchOptions();
}

function populateFinishedSKUDropdowns() {
    const saleProductSelect = document.getElementById('sale-product');
    const batchProductSelect = document.getElementById('batch-product');
    const finishedSKUs = appData.skus.filter(s => s.type === 'Finished Inventory');

    if (saleProductSelect) {
        saleProductSelect.innerHTML = finishedSKUs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        updateProductPrice();
    }

    if (batchProductSelect) {
        const uniqueProductLines = [...new Set(finishedSKUs.map(s => {
            return s.name.includes(' - ') ? s.name.split(' - ')[0].trim() : s.name;
        }))];

        batchProductSelect.innerHTML = uniqueProductLines.map(line => `<option value="${line}">${line}</option>`).join('');
        onBatchProductChange();
    }
}

function onBatchProductChange() {
    const productLineSelect = document.getElementById('batch-product');
    const weightLabel = document.querySelector('label[for="batch-weight"]');
    const unitSelect = document.getElementById('batch-unit');
    
    if (!productLineSelect || !unitSelect) return;
    const selectedLine = productLineSelect.value.toLowerCase();

    const matchingSKUs = appData.skus.filter(s => s.name.toLowerCase().includes(selectedLine));
    const isCountBased = matchingSKUs.some(s => s.measure && s.measure !== 'Pkts' && s.measure !== 'Kg' && s.measure !== 'Gms');

    if (isCountBased || selectedLine.includes('ball') || selectedLine.includes('piece') || selectedLine.includes('pc')) {
        if (weightLabel) weightLabel.innerText = "Batch Quantity Output (Pieces)";
        unitSelect.innerHTML = `
            <option value="Pcs" selected>Pieces (Pcs)</option>
            <option value="Boxes">Boxes</option>
            <option value="Units">Units</option>
        `;
    } else {
        if (weightLabel) weightLabel.innerText = "Batch Weight Output";
        unitSelect.innerHTML = `
            <option value="Gms" selected>Grams (gms)</option>
            <option value="Kg">Kilograms (Kg)</option>
        `;
    }
}

function populateRawMaterialSKUDropdowns() {
    const purItemSelect = document.getElementById('pur-item');
    const rawSKUs = appData.skus.filter(s => s.type === 'Raw Material');

    if (purItemSelect) {
        purItemSelect.innerHTML = rawSKUs.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    }
}

function onProductChange() {
    updateProductPrice();
    updateSaleQuantityLabel();
    populateBatchOptions();
}

function updateSaleQuantityLabel() {
    const productSelect = document.getElementById('sale-product');
    const qtyLabel = document.getElementById('sale-qty-label');
    if (productSelect && qtyLabel) {
        const sku = appData.skus.find(s => s.name === productSelect.value);
        const measure = sku ? (sku.measure || 'Pkts') : 'Pkts';
        qtyLabel.innerText = `Quantity (${measure})`;
    }
}

function updateProductPrice() {
    const productSelect = document.getElementById('sale-product');
    const priceInput = document.getElementById('sale-price');
    const saleMode = document.getElementById('sale-mode').value;

    if (productSelect && priceInput) {
        const selectedSKUName = productSelect.value;
        const matchingSKU = appData.skus.find(s => s.name === selectedSKUName);
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

function onSaleModeChange(selectEl) {
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

function getSaleGrams() {
    const mode = document.getElementById('sale-mode').value;
    const skuName = document.getElementById('sale-product').value;
    const skuRecord = appData.skus.find(s => s.name === skuName);

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

function populateBatchOptions() {
    const batchSelect = document.getElementById('sale-batch');
    const submitBtn = document.getElementById('sale-submit-btn');
    if (!batchSelect) return;

    const matchingBatches = appData.batches.filter(b => Number(b.remainingGrams) > 0);

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

async function addSale(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const skuName = document.getElementById('sale-product').value;
    const selectedBatchCode = document.getElementById('sale-batch').value;
    const saleMode = document.getElementById('sale-mode').value;
    const skuRecord = appData.skus.find(s => s.name === skuName);
    const measure = skuRecord ? (skuRecord.measure || 'Pkts') : 'Pkts';

    if (!selectedBatchCode) {
        alert("Cannot complete sale. No stock available.");
        return;
    }

    const totalGramsSold = getSaleGrams();
    const batch = appData.batches.find(b => b.code === selectedBatchCode);

    if (batch) {
        if (Number(batch.remainingGrams) < totalGramsSold) {
            alert(`Cannot complete sale. Selected batch only has ${formatGrams(batch.remainingGrams)} remaining, but this sale requires ${formatGrams(totalGramsSold)}.`);
            return;
        }
        batch.remainingGrams = Number(batch.remainingGrams) - totalGramsSold;
        if (batch.remainingGrams <= 0) {
            batch.remainingGrams = 0;
            batch.status = 'Sold Out';
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

    appData.sales.push(sale);
    await saveData('sales', sale);
    renderSales();
    renderBatches();
    populateSampleBatchOptions();
    document.getElementById('sales-form').reset();
    document.getElementById('sale-date').value = todayStr;
    onSaleModeChange(document.getElementById('sale-mode'));
}

function clearSalesFilters() {
    const searchInput = document.getElementById('sales-search-filter');
    const dateInput = document.getElementById('sales-date-filter');
    if (searchInput) searchInput.value = '';
    if (dateInput) dateInput.value = '';
    renderSales();
}

function renderSales() {
    const tbody = document.getElementById('sales-table-body');
    if(!tbody) return;
    
    const searchFilter = document.getElementById('sales-search-filter') ? document.getElementById('sales-search-filter').value.toLowerCase().trim() : '';
    const dateFilter = document.getElementById('sales-date-filter') ? document.getElementById('sales-date-filter').value : '';
    
    let displayedSales = appData.sales;

    if (searchFilter) {
        displayedSales = displayedSales.filter(s => s.customer.toLowerCase().includes(searchFilter) || s.product.toLowerCase().includes(searchFilter));
    }

    if (dateFilter) {
        displayedSales = displayedSales.filter(s => s.date === dateFilter);
    }

    let totalSalesValue = displayedSales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalValBox = document.getElementById('sales-total-value');
    const totalLabel = document.getElementById('sales-total-label');
    
    if (totalValBox) totalValBox.innerText = `₹${totalSalesValue}`;
    if (totalLabel) {
        if (dateFilter) {
            totalLabel.innerText = `Filtered Sales Value (${formatDate(dateFilter)}):`;
        } else if (searchFilter) {
            totalLabel.innerText = `Filtered Sales Value ("${searchFilter}"):`;
        } else {
            totalLabel.innerText = 'Total Sales Value:';
        }
    }

    tbody.innerHTML = displayedSales.map((s) => {
        const realIndex = appData.sales.indexOf(s);
        return `
            <tr>
                <td data-label="Date">${formatDate(s.date)}</td>
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

async function deleteSaleItem(index) {
    const saleToDelete = appData.sales[index];
    
    if (saleToDelete && saleToDelete.batchCode && saleToDelete.batchCode !== 'N/A') {
        const batch = appData.batches.find(b => b.code === saleToDelete.batchCode);
        if (batch) {
            const restoredGrams = Number(saleToDelete.gramsSold) || 0;
            batch.remainingGrams = Number(batch.remainingGrams || 0) + restoredGrams;
            batch.status = 'Available';
        }
    }

    await deleteDataDoc('sales', saleToDelete.firebaseId);
    appData.sales.splice(index, 1);
    renderSales();
    renderBatches();
    populateBatchOptions();
    populateSampleBatchOptions();
}

function populateSampleBatchOptions() {
    const batchSelect = document.getElementById('sample-batch');
    const submitBtn = document.getElementById('sample-submit-btn');
    if (!batchSelect) return;

    const matchingBatches = appData.batches.filter(b => Number(b.remainingGrams) > 0);

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

async function addSample(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const qtyVal = Number(document.getElementById('sample-qty').value);
    const unitVal = document.getElementById('sample-unit').value;
    const selectedBatchCode = document.getElementById('sample-batch').value;

    if (!selectedBatchCode) {
        alert("Cannot log sample. No stock available.");
        return;
    }

    const totalGramsGiven = unitVal === 'Kg' ? qtyVal * 1000 : qtyVal;

    const batch = appData.batches.find(b => b.code === selectedBatchCode);
    if (batch) {
        if (Number(batch.remainingGrams) < totalGramsGiven) {
            alert(`Cannot log sample. Selected batch only has ${formatGrams(batch.remainingGrams)} remaining, but this requires ${formatGrams(totalGramsGiven)}.`);
            return;
        }
        batch.remainingGrams = Number(batch.remainingGrams) - totalGramsGiven;
        if (batch.remainingGrams <= 0) {
            batch.remainingGrams = 0;
            batch.status = 'Sold Out';
        }
    }

    const sample = {
        date: document.getElementById('sample-date').value,
        recipient: document.getElementById('sample-recipient').value,
        batchCode: selectedBatchCode,
        qty: qtyVal,
        unit: unitVal,
        gramsGiven: totalGramsGiven,
        purpose: document.getElementById('sample-purpose').value
    };

    appData.samples.push(sample);
    await saveData('samples', sample);
    renderSamples();
    renderBatches();
    populateBatchOptions();
    populateSampleBatchOptions();
    document.getElementById('sample-form').reset();
    document.getElementById('sample-date').value = todayStr;
}

function renderSamples() {
    const tbody = document.getElementById('sample-table-body');
    if(!tbody) return;

    let totalGramsGiven = appData.samples.reduce((sum, s) => sum + Number(s.gramsGiven || 0), 0);
    const totalWeightBox = document.getElementById('sample-total-weight');
    if (totalWeightBox) totalWeightBox.innerText = formatGrams(totalGramsGiven);

    tbody.innerHTML = appData.samples.map((s) => {
        const qtyDisplay = `${s.qty} ${s.unit || 'Gms'} (${formatGrams(s.gramsGiven)})`;
        const realIndex = appData.samples.indexOf(s);
        return `
            <tr>
                <td data-label="Date">${formatDate(s.date)}</td>
                <td data-label="Shoot / Event / Recipient">${s.recipient}</td>
                <td data-label="Batch Code"><code>${s.batchCode || 'N/A'}</code></td>
                <td data-label="Quantity Given">${qtyDisplay}</td>
                <td data-label="Purpose">${s.purpose}</td>
                <td data-label="Action"><button class="btn-danger" onclick="deleteSampleItem(${realIndex})">Delete</button></td>
            </tr>
        `;
    }).join('');
}

async function deleteSampleItem(index) {
    const sampleToDelete = appData.samples[index];
    
    if (sampleToDelete && sampleToDelete.batchCode && sampleToDelete.batchCode !== 'N/A') {
        const batch = appData.batches.find(b => b.code === sampleToDelete.batchCode);
        if (batch) {
            batch.remainingGrams = Number(batch.remainingGrams || 0) + Number(sampleToDelete.gramsGiven || 0);
            batch.status = 'Available';
        }
    }

    await deleteDataDoc('samples', sampleToDelete.firebaseId);
    appData.samples.splice(index, 1);
    renderSamples();
    renderBatches();
    populateBatchOptions();
    populateSampleBatchOptions();
}

async function addBatch(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const dateVal = document.getElementById('batch-date').value;
    const formattedDate = dateVal.replaceAll('-', '');
    const shiftVal = document.getElementById('batch-shift').value.slice(0, 2);
    const productLine = document.getElementById('batch-product').value;
    const weightVal = Number(document.getElementById('batch-weight').value);
    const unitVal = document.getElementById('batch-unit').value;
    
    let totalGrams = weightVal;
    if (unitVal === 'Kg') totalGrams = weightVal * 1000;
    else if (unitVal === 'Pcs' || unitVal === 'Boxes' || unitVal === 'Units') {
        const matchingSKU = appData.skus.find(s => s.name.toLowerCase().includes(productLine.toLowerCase()));
        const singleGrams = matchingSKU ? matchingSKU.grams : 50;
        totalGrams = weightVal * singleGrams;
    }

    const batchCode = `KBS-${formattedDate}-${shiftVal}`;

    let mfgDateObj = new Date(dateVal);
    mfgDateObj.setDate(mfgDateObj.getDate() + 45);
    const expiryDateStr = mfgDateObj.toISOString().split('T')[0];

    const batch = {
        code: batchCode,
        date: dateVal,
        expiryDate: expiryDateStr,
        product: productLine,
        shift: document.getElementById('batch-shift').value,
        totalGrams: totalGrams,
        remainingGrams: totalGrams,
        status: 'Available'
    };
    appData.batches.push(batch);
    await saveData('batches', batch);
    renderBatches();
    populateBatchOptions();
    populateSampleBatchOptions();
    document.getElementById('batch-form').reset();
    document.getElementById('batch-date').value = todayStr;
}

function renderBatches() {
    const tbody = document.getElementById('batch-table-body');
    if(!tbody) return;
    tbody.innerHTML = appData.batches.map((b, index) => {
        const remGrams = b.remainingGrams !== undefined ? b.remainingGrams : 0;
        const totalGrams = b.totalGrams || remGrams;

        return `
            <tr>
                <td data-label="Batch Code"><code>${b.code}</code></td>
                <td data-label="Mfg Date">${formatDate(b.date)}</td>
                <td data-label="Expiry Date">${formatDate(b.expiryDate)}</td>
                <td data-label="Product Line">${b.product}</td>
                <td data-label="Shift">${b.shift}</td>
                <td data-label="Available Bulk Stock"><strong>${formatGrams(remGrams)}</strong> / ${formatGrams(totalGrams)}</td>
                <td data-label="Status"><span class="status-badge ${remGrams <= 0 ? 'status-soldout' : ''}">${b.status}</span></td>
                <td data-label="Action"><button class="btn-danger" onclick="deleteBatchItem(${index})">Delete</button></td>
            </tr>
        `;
    }).join('');
}

async function deleteBatchItem(index) {
    const batchToDelete = appData.batches[index];
    await deleteDataDoc('batches', batchToDelete.firebaseId);
    appData.batches.splice(index, 1);
    renderBatches();
    populateBatchOptions();
    populateSampleBatchOptions();
}

function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    let purchasedMap = {};
    appData.purchases.forEach(p => {
        let masterName = normalizeIngredientName(p.item);
        if (!defaultRecipePer500g[masterName]) return;

        let qty = Number(p.qty) || 0;
        let unit = (p.unit || 'Kg').toLowerCase();

        if (!purchasedMap[masterName]) {
            purchasedMap[masterName] = { total: 0, unit: defaultRecipePer500g[masterName].unit };
        }

        let qtyInBase = qty;
        if (unit === 'kg' || unit === 'ltrs') qtyInBase = qty * 1000;

        purchasedMap[masterName].total += qtyInBase;
    });

    let consumedMap = {};
    appData.batches.forEach(b => {
        let batchGrams = Number(b.totalGrams) || 0;
        let scaleFactor = batchGrams / 500;

        for (let [ingredient, data] of Object.entries(defaultRecipePer500g)) {
            let masterName = normalizeIngredientName(ingredient);
            let consumedAmt = data.qty * scaleFactor;
            consumedMap[masterName] = (consumedMap[masterName] || 0) + consumedAmt;
        }
    });

    let rawIngredients = Object.keys(defaultRecipePer500g);
    let rowsHtml = [];

    rawIngredients.forEach(item => {
        let boughtInfo = purchasedMap[item] || { total: 0, unit: defaultRecipePer500g[item].unit };
        let totalBought = boughtInfo.total;
        let totalUsed = consumedMap[item] || 0;
        let balance = totalBought - totalUsed;

        let prefUnit = defaultRecipePer500g[item].unit;
        let category = defaultRecipePer500g[item].category;

        let displayBought = formatDynamicValue(totalBought, prefUnit);
        let displayUsed = formatDynamicValue(totalUsed, prefUnit);
        let displayBalance = formatDynamicValue(balance, prefUnit);

        let isLow = balance <= 500;
        let statusTag = isLow ? '⚠️ Low Stock' : 'Optimal';
        let alertStyle = isLow ? 'color: #dc2626; font-weight: 700;' : '';

        rowsHtml.push(`
            <tr>
                <td data-label="Raw Ingredient"><strong>${item}</strong></td>
                <td data-label="Category">${category}</td>
                <td data-label="Total Purchased">${displayBought}</td>
                <td data-label="Consumed (Batches)">${displayUsed}</td>
                <td data-label="Current Balance Stock"><strong style="${alertStyle}">${displayBalance}</strong></td>
                <td data-label="Stock Level Status"><span class="status-badge" style="${alertStyle}">${statusTag}</span></td>
            </tr>
        `);
    });

    tbody.innerHTML = rowsHtml.join('');
}

async function addPurchase(e) {
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
    appData.purchases.push(pur);
    await saveData('purchases', pur);
    renderPurchases();
    document.getElementById('purchase-form').reset();
    document.getElementById('pur-date').value = todayStr;
}

function clearPurchaseFilters() {
    const searchInput = document.getElementById('pur-search-filter');
    const dateInput = document.getElementById('pur-date-filter');
    if (searchInput) searchInput.value = '';
    if (dateInput) dateInput.value = '';
    renderPurchases();
}

function renderPurchases() {
    const tbody = document.getElementById('purchase-table-body');
    if(!tbody) return;

    const searchFilter = document.getElementById('pur-search-filter') ? document.getElementById('pur-search-filter').value.toLowerCase().trim() : '';
    const dateFilter = document.getElementById('pur-date-filter') ? document.getElementById('pur-date-filter').value : '';

    let displayedPurchases = appData.purchases;

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
        const realIndex = appData.purchases.indexOf(p);
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

async function deletePurchaseItem(index) {
    const purchaseToDelete = appData.purchases[index];
    await deleteDataDoc('purchases', purchaseToDelete.firebaseId);
    appData.purchases.splice(index, 1);
    renderPurchases();
}

function exportJSON() {
    const todayStr = new Date().toISOString().split('T')[0];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `kb_savouries_backup_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function exportCSV(type) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (type === 'inventory') {
        let csvContent = "data:text/csv;charset=utf-8,Raw Ingredient,Category,Total Purchased,Consumed (Batches),Current Balance Stock,Stock Level Status\n";
        
        let purchasedMap = {};
        appData.purchases.forEach(p => {
            let m = normalizeIngredientName(p.item);
            if (!defaultRecipePer500g[m]) return;
            let q = Number(p.qty) || 0;
            if (!purchasedMap[m]) purchasedMap[m] = { total: 0, unit: defaultRecipePer500g[m].unit };
            purchasedMap[m].total += (p.unit && (p.unit.toLowerCase() === 'kg' || p.unit.toLowerCase() === 'ltrs')) ? q * 1000 : q;
        });

        let consumedMap = {};
        appData.batches.forEach(b => {
            let scale = (Number(b.totalGrams) || 0) / 500;
            for (let [ing, data] of Object.entries(defaultRecipePer500g)) {
                let m = normalizeIngredientName(ing);
                consumedMap[m] = (consumedMap[m] || 0) + (data.qty * scale);
            }
        });

        Object.keys(defaultRecipePer500g).forEach(item => {
            let boughtInfo = purchasedMap[item] || { total: 0, unit: defaultRecipePer500g[item].unit };
            let totalBought = boughtInfo.total;
            let totalUsed = consumedMap[item] || 0;
            let bal = totalBought - totalUsed;

            let prefUnit = defaultRecipePer500g[item].unit;
            let category = defaultRecipePer500g[item].category;

            let displayBought = formatDynamicValue(totalBought, prefUnit);
            let displayUsed = formatDynamicValue(totalUsed, prefUnit);
            let displayBalance = formatDynamicValue(bal, prefUnit);
            let statusTag = bal <= 500 ? 'Low Stock' : 'Optimal';

            csvContent += `"${item}","${category}","${displayBought}","${displayUsed}","${displayBalance}","${statusTag}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `kb_savouries_inventory_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
    }

    let items = appData[type];
    if(!items || items.length === 0) {
        alert("No data available to export in " + type);
        return;
    }
    let keys = Object.keys(items[0]);
    let csvContent = "data:text/csv;charset=utf-8," + keys.join(",") + "\n";
    items.forEach(row => {
        let val = keys.map(k => `"${row[k]}"`).join(",");
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

// Explicitly expose functions to window scope for inline HTML event handlers
window.switchTab = switchTab;
window.addSKU = addSKU;
window.editSKUItem = editSKUItem;
window.cancelSKUEdit = cancelSKUEdit;
window.deleteSKUItem = deleteSKUItem;
window.onSKUTypeChange = onSKUTypeChange;
window.onBatchProductChange = onBatchProductChange;
window.updateProductPrice = updateProductPrice;
window.onProductChange = onProductChange;
window.onSaleModeChange = onSaleModeChange;
window.addPurchase = addPurchase;
window.addSale = addSale;
window.addBatch = addBatch;
window.addSample = addSample;
window.deletePurchaseItem = deletePurchaseItem;
window.deleteSaleItem = deleteSaleItem;
window.deleteBatchItem = deleteBatchItem;
window.deleteSampleItem = deleteSampleItem;
window.clearSalesFilters = clearSalesFilters;
window.clearPurchaseFilters = clearPurchaseFilters;
window.exportCSV = exportCSV;
window.exportJSON = exportJSON;
window.toggleSidebar = toggleSidebar;