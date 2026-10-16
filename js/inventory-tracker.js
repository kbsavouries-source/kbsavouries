// ==========================================================================
// Inventory Tracker Module Logic (Single-Click Reset & Searchable Filter)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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
    batches: [],
    boms: []
};

let ingredientTomSelectInstance = null;

export async function initInventoryTracker() {
    try {
        const collections = ['skus', 'purchases', 'batches', 'boms'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for inventory tracker:", err);
    }

    populateIngredientFilter();
    renderInventoryTracker();
}

function normalizeUnitQty(qty, unit) {
    const num = Number(qty) || 0;
    const u = (unit || 'Kg').toLowerCase().trim();
    
    if (u === 'kg' || u === 'ltrs' || u === 'ltr') {
        return num * 1000;
    }
    return num;
}

function formatDisplayStock(qtyGms, preferredUnit) {
    const val = Number(qtyGms) || 0;
    const u = (preferredUnit || 'Kg').toLowerCase().trim();

    if (u === 'kg' || u === 'ltrs' || u === 'ltr') {
        return `${(val / 1000).toFixed(2)} ${preferredUnit || 'Kg'}`;
    }
    return `${val.toFixed(0)} ${preferredUnit || 'Gms'}`;
}

export function populateIngredientFilter() {
    const filterSelect = document.getElementById('inventory-ingredient-filter');
    if (!filterSelect || !window.appData.skus) return;

    const rawMaterials = window.appData.skus.filter(s => s.type === 'Raw Material');

    filterSelect.innerHTML = `<option value="">All Ingredients (Combined)</option>` + 
        rawMaterials.map(rm => `<option value="${rm.name}">${rm.name}</option>`).join('');

    if (window.TomSelect) {
        if (ingredientTomSelectInstance) {
            ingredientTomSelectInstance.destroy();
        }
        ingredientTomSelectInstance = new TomSelect(filterSelect, {
            create: false,
            sortField: { field: "text", direction: "asc" },
            onChange: () => {
                renderInventoryTracker();
            }
        });
    }
}

export function renderInventoryTracker() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody || !window.appData.skus) return;

    const filterEl = document.getElementById('inventory-ingredient-filter');
    const selectedIngredient = filterEl ? filterEl.value.trim().toLowerCase() : '';

    let rawMaterials = window.appData.skus.filter(s => s.type === 'Raw Material');

    // Filter by specific raw ingredient if selected
    if (selectedIngredient) {
        rawMaterials = rawMaterials.filter(rm => rm.name.trim().toLowerCase() === selectedIngredient);
    }

    if (rawMaterials.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 32px;">No matching raw materials found.</td></tr>`;
        return;
    }

    // 1. Dynamic Calculation: Purchased Stock from "Received" POs
    const purchasedTotals = {};
    const receivedPOs = (window.appData.purchases || []).filter(p => p.status === 'Received');

    receivedPOs.forEach(p => {
        const purItems = p.items || [{ item: p.item, qty: p.qty, unit: p.unit }];
        purItems.forEach(i => {
            if (!i.item) return;
            const key = i.item.trim().toLowerCase();
            const normalizedGrams = normalizeUnitQty(i.qty, i.unit);

            if (!purchasedTotals[key]) {
                purchasedTotals[key] = 0;
            }
            purchasedTotals[key] += normalizedGrams;
        });
    });

    // 2. Dynamic Calculation: Consumed Stock from Production Batches
    const consumedTotals = {};
    const batches = window.appData.batches || [];

    batches.forEach(b => {
        if (!b.ingredients || !Array.isArray(b.ingredients)) return;
        b.ingredients.forEach(ing => {
            if (!ing.name) return;
            const ingKey = ing.name.trim().toLowerCase();
            const ingQty = normalizeUnitQty(ing.qty, ing.unit);

            if (!consumedTotals[ingKey]) {
                consumedTotals[ingKey] = 0;
            }
            consumedTotals[ingKey] += ingQty;
        });
    });

    // 3. Render Table Rows
    tbody.innerHTML = rawMaterials.map(rm => {
        const key = rm.name.trim().toLowerCase();
        const totalPurchasedGms = purchasedTotals[key] || 0;
        const totalConsumedGms = consumedTotals[key] || 0;
        const balanceGms = totalPurchasedGms - totalConsumedGms;

        const preferredUnit = rm.unit || 'Kg';
        const displayPurchased = formatDisplayStock(totalPurchasedGms, preferredUnit);
        const displayConsumed = formatDisplayStock(totalConsumedGms, preferredUnit);
        const displayBalance = formatDisplayStock(balanceGms, preferredUnit);

        let statusBadge = `<span class="status-badge received">IN STOCK</span>`;
        if (balanceGms <= 0) {
            statusBadge = `<span class="status-badge pending" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;">OUT OF STOCK</span>`;
        } else if (balanceGms < 2000) {
            statusBadge = `<span class="status-badge pending">LOW STOCK</span>`;
        }

        return `
            <tr>
                <td data-label="Raw Ingredient"><strong>${rm.name}</strong></td>
                <td data-label="Category">${rm.type || 'Raw Material'}</td>
                <td data-label="Total Purchased"><strong style="color: #16a34a;">${displayPurchased}</strong></td>
                <td data-label="Consumed (Batches)"><strong style="color: #dc2626;">${displayConsumed}</strong></td>
                <td data-label="Current Balance Stock"><strong style="color: var(--accent-orange, #EA580C); font-size: 0.95rem;">${displayBalance}</strong></td>
                <td data-label="Stock Level Status">${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

window.renderInventoryTracker = renderInventoryTracker;
window.resetInventoryFilter = function() {
    if (ingredientTomSelectInstance) {
        ingredientTomSelectInstance.clear(); // Instantly clears selection on first click
        ingredientTomSelectInstance.close();
    }
    const filterSelect = document.getElementById('inventory-ingredient-filter');
    if (filterSelect) filterSelect.value = '';
    renderInventoryTracker();
};

document.addEventListener('DOMContentLoaded', () => {
    initInventoryTracker();
});