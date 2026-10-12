// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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
    sales: [],
    batches: [],
    purchases: [],
    samples: []
};

// Standard product prices and unit weight mapping in grams
const productConfig = {
    "Poha Crunch - 30g": { price: 15, grams: 30, line: "Poha Crunch" },
    "Poha Crunch - 50g": { price: 25, grams: 50, line: "Poha Crunch" },
    "Poha Crunch - 250g": { price: 110, grams: 250, line: "Poha Crunch" },
    "Poha Crunch - 500g": { price: 210, grams: 500, line: "Poha Crunch" },
    "Poha Crunch - 1 Kg": { price: 400, grams: 1000, line: "Poha Crunch" }
};

// Recipe BOM proportions per 500g of finished Poha Crunch inventory (Raw Ingredients Only)
const pohaCrunchRecipePer500g = {
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

// Load data from Firestore cloud collections
async function loadCloudData() {
    try {
        const collections = ['sales', 'batches', 'purchases', 'samples'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }

        // Migration fallback: If cloud is empty and localStorage has data, migrate it once
        const localData = JSON.parse(localStorage.getItem('kb_savouries_data'));
        if (localData && appData.sales.length === 0 && appData.batches.length === 0) {
            if (localData.sales) {
                for (let s of localData.sales) await addDoc(collection(db, 'sales'), s);
            }
            if (localData.batches) {
                for (let b of localData.batches) await addDoc(collection(db, 'batches'), b);
            }
            if (localData.purchases) {
                for (let p of localData.purchases) await addDoc(collection(db, 'purchases'), p);
            }
            if (localData.samples) {
                for (let sm of localData.samples) await addDoc(collection(db, 'samples'), sm);
            }
            // Reload cloud data after migration
            for (const colName of collections) {
                const querySnapshot = await getDocs(collection(db, colName));
                appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
            }
        }
    } catch (err) {
        console.error("Error loading cloud data, falling back to local storage:", err);
        appData = JSON.parse(localStorage.getItem('kb_savouries_data')) || { sales: [], batches: [], purchases: [], samples: [] };
    }

    if (!appData.samples) appData.samples = [];

    onProductChange();
    populateSampleBatchOptions();
    updatePurchaseDropdownOptions();

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
    updatePurchaseDropdownOptions();
}

async function deleteDataDoc(collectionName, firebaseId, localIndex) {
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

function checkCustomItem(selectEl) {
    const customWrapper = document.getElementById('custom-item-wrapper');
    const customInput = document.getElementById('pur-custom-item');
    if (selectEl.value === "-- ADD NEW ITEM --") {
        customWrapper.style.display = 'block';
        customInput.required = true;
        customInput.focus();
    } else {
        customWrapper.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
}

function updatePurchaseDropdownOptions() {
    const selectEl = document.getElementById('pur-item');
    if (!selectEl) return;

    let knownItems = new Set([
        "Poha", "Peanut", "Roasted Channa", "Rice Bran Oil", "Curry Leaves", "Turmeric", "Chilli Powder", "Salt",
        "Aluminium Pouch (Small)", "Aluminium Pouch (Medium)", "Aluminium Pouch (Large)", "Tissue Paper", "Sticker", "LPG Gas Cylinder"
    ]);

    appData.purchases.forEach(p => {
        if (p.item) knownItems.add(normalizeIngredientName(p.item));
    });

    let currentVal = selectEl.value;
    let optionsHtml = '';
    knownItems.forEach(item => {
        optionsHtml += `<option value="${item}">${item}</option>`;
    });
    optionsHtml += `<option value="-- ADD NEW ITEM --" style="font-weight: bold; color: var(--accent-primary);">+ Add New Custom Item...</option>`;
    
    selectEl.innerHTML = optionsHtml;
    if (knownItems.has(currentVal)) {
        selectEl.value = currentVal;
    }
}

function onProductChange() {
    updateProductPrice();
    populateBatchOptions();
}

function updateProductPrice() {
    const productSelect = document.getElementById('sale-product');
    const priceInput = document.getElementById('sale-price');
    if (productSelect && priceInput) {
        const selectedSKU = productSelect.value;
        if (productConfig[selectedSKU]) {
            priceInput.value = productConfig[selectedSKU].price;
        }
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
    const sku = document.getElementById('sale-product').value;
    const pktsSold = Number(document.getElementById('sale-qty').value);
    const selectedBatchCode = document.getElementById('sale-batch').value;

    if (!selectedBatchCode) {
        alert("Cannot complete sale. No stock available.");
        return;
    }

    const singlePktGrams = productConfig[sku] ? productConfig[sku].grams : 50;
    const totalGramsSold = pktsSold * singlePktGrams;

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

    const sale = {
        date: document.getElementById('sale-date').value,
        customer: document.getElementById('sale-customer').value,
        product: sku,
        batchCode: selectedBatchCode,
        qty: pktsSold,
        gramsSold: totalGramsSold,
        price: document.getElementById('sale-price').value,
        total: pktsSold * document.getElementById('sale-price').value,
        method: document.getElementById('sale-pay').value
    };

    appData.sales.push(sale);
    await saveData('sales', sale);
    renderSales();
    renderBatches();
    populateSampleBatchOptions();
    document.getElementById('sales-form').reset();
    document.getElementById('sale-date').value = todayStr;
    onProductChange();
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
                <td data-label="Qty">${s.qty} Pkts</td>
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
            const singlePktGrams = productConfig[saleToDelete.product] ? productConfig[saleToDelete.product].grams : 50;
            const restoredGrams = Number(saleToDelete.gramsSold) || (Number(saleToDelete.qty) * singlePktGrams);
            batch.remainingGrams = Number(batch.remainingGrams || 0) + restoredGrams;
            batch.status = 'Available';
        }
    }

    await deleteDataDoc('sales', saleToDelete.firebaseId, index);
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

    tbody.innerHTML = appData.samples.map((s, index) => {
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

    await deleteDataDoc('samples', sampleToDelete.firebaseId, index);
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
    
    const totalGrams = unitVal === 'Kg' ? weightVal * 1000 : weightVal;
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
        const remGrams = b.remainingGrams !== undefined ? b.remainingGrams : (b.qty ? b.qty * (b.weightPerPkt || 50) : 0);
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
    await deleteDataDoc('batches', batchToDelete.firebaseId, index);
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
        if (!pohaCrunchRecipePer500g[masterName]) return;

        let qty = Number(p.qty) || 0;
        let unit = (p.unit || 'Kg').toLowerCase();

        if (!purchasedMap[masterName]) {
            purchasedMap[masterName] = { total: 0, unit: pohaCrunchRecipePer500g[masterName].unit };
        }

        let qtyInBase = qty;
        if (unit === 'kg' || unit === 'ltrs') qtyInBase = qty * 1000;

        purchasedMap[masterName].total += qtyInBase;
    });

    let consumedMap = {};
    appData.batches.forEach(b => {
        let batchGrams = Number(b.totalGrams) || 0;
        let scaleFactor = batchGrams / 500;

        for (let [ingredient, data] of Object.entries(pohaCrunchRecipePer500g)) {
            let masterName = normalizeIngredientName(ingredient);
            let consumedAmt = data.qty * scaleFactor;
            consumedMap[masterName] = (consumedMap[masterName] || 0) + consumedAmt;
        }
    });

    let rawIngredients = Object.keys(pohaCrunchRecipePer500g);
    let rowsHtml = [];

    rawIngredients.forEach(item => {
        let boughtInfo = purchasedMap[item] || { total: 0, unit: pohaCrunchRecipePer500g[item].unit };
        let totalBought = boughtInfo.total;
        let totalUsed = consumedMap[item] || 0;
        let balance = totalBought - totalUsed;

        let prefUnit = pohaCrunchRecipePer500g[item].unit;
        let category = pohaCrunchRecipePer500g[item].category;

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
    
    let itemVal = document.getElementById('pur-item').value;
    if (itemVal === "-- ADD NEW ITEM --") {
        const customInput = document.getElementById('pur-custom-item').value.trim();
        if (customInput) {
            itemVal = customInput;
        } else {
            alert("Please provide a valid custom item name.");
            return;
        }
    }

    const pur = {
        date: document.getElementById('pur-date').value,
        vendor: document.getElementById('pur-vendor').value,
        item: itemVal,
        qty: document.getElementById('pur-qty').value,
        unit: document.getElementById('pur-unit').value,
        amt: document.getElementById('pur-amt').value
    };
    appData.purchases.push(pur);
    await saveData('purchases', pur);
    renderPurchases();
    document.getElementById('purchase-form').reset();
    document.getElementById('pur-date').value = todayStr;
    document.getElementById('custom-item-wrapper').style.display = 'none';
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
    await deleteDataDoc('purchases', purchaseToDelete.firebaseId, index);
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
            if (!pohaCrunchRecipePer500g[m]) return;
            let q = Number(p.qty) || 0;
            if (!purchasedMap[m]) purchasedMap[m] = { total: 0, unit: pohaCrunchRecipePer500g[m].unit };
            purchasedMap[m].total += (p.unit && (p.unit.toLowerCase() === 'kg' || p.unit.toLowerCase() === 'ltrs')) ? q * 1000 : q;
        });

        let consumedMap = {};
        appData.batches.forEach(b => {
            let scale = (Number(b.totalGrams) || 0) / 500;
            for (let [ing, data] of Object.entries(pohaCrunchRecipePer500g)) {
                let m = normalizeIngredientName(ing);
                consumedMap[m] = (consumedMap[m] || 0) + (data.qty * scale);
            }
        });

        Object.keys(pohaCrunchRecipePer500g).forEach(item => {
            let boughtInfo = purchasedMap[item] || { total: 0, unit: pohaCrunchRecipePer500g[item].unit };
            let totalBought = boughtInfo.total;
            let totalUsed = consumedMap[item] || 0;
            let bal = totalBought - totalUsed;

            let prefUnit = pohaCrunchRecipePer500g[item].unit;
            let category = pohaCrunchRecipePer500g[item].category;

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
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kb_savouries_${type}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

window.switchTab = function(tabId, event) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    document.getElementById('page-title').innerText = event.currentTarget.innerText;

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
};
window.addPurchase = addPurchase;
window.addSale = addSale;
window.addBatch = addBatch;
window.addSample = addSample;
window.deletePurchaseItem = deletePurchaseItem;
window.deleteSaleItem = deleteSaleItem;
window.deleteBatchItem = deleteBatchItem;
window.deleteSampleItem = deleteSampleItem;
window.checkCustomItem = checkCustomItem;
window.onProductChange = onProductChange;
window.clearSalesFilters = clearSalesFilters;
window.clearPurchaseFilters = clearPurchaseFilters;
window.exportCSV = exportCSV;
window.exportJSON = exportJSON;


window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
};



