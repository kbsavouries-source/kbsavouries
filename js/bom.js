// ==========================================================================
// BOM Master Module Logic (with Tom Select searchable raw ingredient dropdowns)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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
    boms: []
};

export async function initBOM() {
    try {
        const collections = ['skus', 'boms'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for BOM:", err);
    }

    populateFinishedSKUDropdowns();
}

export function populateFinishedSKUDropdowns() {
    const productSelect = document.getElementById('bom-product');
    const finishedSKUs = window.appData.skus.filter(s => s.type === 'Finished Inventory');

    if (productSelect) {
        const uniqueProductLines = [...new Set(finishedSKUs.map(s => {
            return s.name.includes(' - ') ? s.name.split(' - ')[0].trim() : s.name;
        }))];

        productSelect.innerHTML = uniqueProductLines.map(line => `<option value="${line}">${line}</option>`).join('');
        if (window.TomSelect) {
            new TomSelect('#bom-product', { create: false, sortField: { field: "text", direction: "asc" } });
        }
        onBOMProductChange();
    }
}

export function onBOMProductChange() {
    const productSelect = document.getElementById('bom-product');
    if (!productSelect) return;
    const selectedLine = productSelect.value;

    const existingBOM = window.appData.boms.find(b => b.productLine === selectedLine);
    const container = document.getElementById('bom-ingredients-container');
    const baseOutputInput = document.getElementById('bom-base-output');

    container.innerHTML = '';

    if (existingBOM) {
        baseOutputInput.value = existingBOM.baseOutputGrams || 500;
        existingBOM.ingredients.forEach(ing => {
            addBOMRow(ing.name, ing.qty, ing.unit);
        });
    } else {
        baseOutputInput.value = 500;
        addBOMRow('Poha', 250, 'gms');
        addBOMRow('Peanut', 63, 'gms');
        addBOMRow('Rice Bran Oil', 500, 'ml');
    }
}

export function addBOMRow(name = '', qty = '', unit = 'gms') {
    const container = document.getElementById('bom-ingredients-container');
    const rawSKUs = window.appData.skus.filter(s => s.type === 'Raw Material');

    const row = document.createElement('div');
    row.className = 'bom-row';
    
    let optionsHtml = rawSKUs.map(s => `<option value="${s.name}" ${s.name === name ? 'selected' : ''}>${s.name}</option>`).join('');

    row.innerHTML = `
        <select class="bom-ing-name" required>
            <option value="">Select Raw Material</option>
            ${optionsHtml}
        </select>
        <input type="number" class="bom-ing-qty" placeholder="Qty" value="${qty !== '' ? Number(qty).toFixed(2).replace(/\.?0+$/, '') : ''}" step="any" required>
        <select class="bom-ing-unit" required>
            <option value="gms" ${unit === 'gms' ? 'selected' : ''}>Grams (gms)</option>
            <option value="ml" ${unit === 'ml' ? 'selected' : ''}>Milliliters (ml)</option>
            <option value="kg" ${unit === 'kg' ? 'selected' : ''}>Kilograms (Kg)</option>
            <option value="ltrs" ${unit === 'ltrs' ? 'selected' : ''}>Liters (Ltrs)</option>
        </select>
        <button type="button" class="btn-danger btn-remove-row" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);

    // Initialize Tom Select on the newly created ingredient dropdown
    const selectEl = row.querySelector('.bom-ing-name');
    if (window.TomSelect && selectEl) {
        new TomSelect(selectEl, {
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }
}

export async function saveBOM(e) {
    e.preventDefault();
    const productLine = document.getElementById('bom-product').value;
    const baseOutputGrams = Number(document.getElementById('bom-base-output').value) || 500;

    const rows = document.querySelectorAll('#bom-ingredients-container > div');
    let ingredients = [];

    rows.forEach(r => {
        // Handle value retrieval whether Tom Select is active or standard select
        const selectEl = r.querySelector('.bom-ing-name');
        const name = selectEl ? (selectEl.tomselect ? selectEl.tomselect.getValue() : selectEl.value) : '';
        const qty = Number(r.querySelector('.bom-ing-qty').value) || 0;
        const unit = r.querySelector('.bom-ing-unit').value;
        if (name) ingredients.push({ name, qty, unit });
    });

    if (ingredients.length === 0) {
        alert("Please add at least one ingredient to the BOM.");
        return;
    }

    const bomData = { productLine, baseOutputGrams, ingredients };
    const existingIndex = window.appData.boms.findIndex(b => b.productLine === productLine);

    if (existingIndex !== -1) {
        const bomRecord = window.appData.boms[existingIndex];
        bomRecord.baseOutputGrams = baseOutputGrams;
        bomRecord.ingredients = ingredients;

        if (bomRecord.firebaseId) {
            try {
                await updateDoc(doc(db, 'boms', bomRecord.firebaseId), { baseOutputGrams, ingredients });
                alert("BOM updated successfully!");
            } catch (err) {
                console.error("Error updating BOM:", err);
            }
        }
    } else {
        try {
            const docRef = await addDoc(collection(db, 'boms'), bomData);
            bomData.firebaseId = docRef.id;
            window.appData.boms.push(bomData);
            alert("BOM saved successfully!");
        } catch (err) {
            console.error("Error saving BOM:", err);
        }
    }
}

window.onBOMProductChange = onBOMProductChange;
window.addBOMRow = addBOMRow;
window.saveBOM = saveBOM;

document.addEventListener('DOMContentLoaded', () => {
    initBOM();
});