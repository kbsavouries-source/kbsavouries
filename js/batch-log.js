// ==========================================================================
// Batch Log Module Logic
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
    sales: [],
    batches: [],
    purchases: [],
    samples: []
};

export async function initBatchLog() {
    const todayStr = new Date().toISOString().split('T')[0];
    const batchDateEl = document.getElementById('batch-date');
    if (batchDateEl) batchDateEl.value = todayStr;

    try {
        const collections = ['skus', 'batches'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for batches:", err);
    }

    populateFinishedSKUDropdowns();

    // Initialize Tom Select for searchable dropdown
    if (window.TomSelect) {
        new TomSelect('#batch-product', { 
            create: false, 
            sortField: { field: "text", direction: "asc" } 
        });
    }

    renderBatches();
}

export function populateFinishedSKUDropdowns() {
    const batchProductSelect = document.getElementById('batch-product');
    const finishedSKUs = window.appData.skus.filter(s => s.type === 'Finished Inventory');

    if (batchProductSelect) {
        const uniqueProductLines = [...new Set(finishedSKUs.map(s => {
            return s.name.includes(' - ') ? s.name.split(' - ')[0].trim() : s.name;
        }))];

        batchProductSelect.innerHTML = uniqueProductLines.map(line => `<option value="${line}">${line}</option>`).join('');
        onBatchProductChange();
    }
}

export function onBatchProductChange() {
    const productLineSelect = document.getElementById('batch-product');
    const weightLabel = document.querySelector('label[for="batch-weight"]');
    const unitSelect = document.getElementById('batch-unit');
    
    if (!productLineSelect || !unitSelect) return;
    const selectedLine = productLineSelect.value.toLowerCase();

    const matchingSKUs = window.appData.skus.filter(s => s.name.toLowerCase().includes(selectedLine));
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

export async function addBatch(e) {
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
        const matchingSKU = window.appData.skus.find(s => s.name.toLowerCase().includes(productLine.toLowerCase()));
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

    window.appData.batches.push(batch);
    try {
        await addDoc(collection(db, 'batches'), batch);
    } catch (err) {
        console.error("Error saving batch:", err);
    }

    renderBatches();
    document.getElementById('batch-form').reset();
    document.getElementById('batch-date').value = todayStr;
}

export function formatGrams(grams) {
    const g = Number(grams) || 0;
    if (Math.abs(g) >= 1000) {
        return `${(g / 1000).toFixed(2)} Kg`;
    }
    return `${g.toFixed(g % 1 === 0 ? 0 : 1)} gms`;
}

export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

export function renderBatches() {
    const tbody = document.getElementById('batch-table-body');
    if(!tbody || !window.appData) return;

    tbody.innerHTML = window.appData.batches.map((b, index) => {
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

export async function deleteBatchItem(index) {
    if (!window.appData) return;
    const batchToDelete = window.appData.batches[index];
    if (batchToDelete && batchToDelete.firebaseId) {
        try {
            await deleteDoc(doc(db, 'batches', batchToDelete.firebaseId));
        } catch (err) {
            console.error("Error deleting batch:", err);
        }
    }
    window.appData.batches.splice(index, 1);
    renderBatches();
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
window.onBatchProductChange = onBatchProductChange;
window.addBatch = addBatch;
window.deleteBatchItem = deleteBatchItem;
window.exportCSV = exportCSV;

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initBatchLog();
});