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
    sales: [],
    samples: [],
    inventory: []
};

export async function initInventoryTracker() {
    try {
        const collections = ['skus', 'purchases', 'batches', 'sales', 'samples', 'inventory'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for inventory tracker:", err);
    }

    renderInventoryLedger();
}

/* ==========================================================================
   UNIT HANDLING
   Mass   -> base unit: gms  (1 Kg   = 1000 gms)
   Volume -> base unit: ml   (1 Ltr  = 1000 ml)
   Count  -> Pkts / Units / Pieces / Boxes (no conversion)
   ========================================================================== */
const UNIT_TABLE = {
    kg:     { family: 'mass',   factor: 1000 },
    kgs:    { family: 'mass',   factor: 1000 },
    kilogram:  { family: 'mass', factor: 1000 },
    kilograms: { family: 'mass', factor: 1000 },
    g:      { family: 'mass',   factor: 1 },
    gm:     { family: 'mass',   factor: 1 },
    gms:    { family: 'mass',   factor: 1 },
    gram:   { family: 'mass',   factor: 1 },
    grams:  { family: 'mass',   factor: 1 },
    l:      { family: 'volume', factor: 1000 },
    lt:     { family: 'volume', factor: 1000 },
    ltr:    { family: 'volume', factor: 1000 },
    ltrs:   { family: 'volume', factor: 1000 },
    liter:  { family: 'volume', factor: 1000 },
    liters: { family: 'volume', factor: 1000 },
    litre:  { family: 'volume', factor: 1000 },
    litres: { family: 'volume', factor: 1000 },
    ml:     { family: 'volume', factor: 1 },
    mls:    { family: 'volume', factor: 1 }
};

function getUnitInfo(unit) {
    const key = String(unit || '').trim().toLowerCase().replace(/\./g, '');
    return UNIT_TABLE[key] || { family: 'count', factor: 1 };
}

// Convert a quantity in any supported unit into base units (gms / ml / count)
function normalizeQty(qty, unit) {
    return (Number(qty) || 0) * getUnitInfo(unit).factor;
}

// Format a base-unit value for display, using the SKU Catalog's unit
// e.g. 1500 (ml) + "Ltrs" -> "1.50 Ltrs"; 2000 (gms) + "Kg" -> "2.00 Kg"; 750 + "Kg" -> "750 gms"
function formatDisplayQty(val, catalogUnit) {
    const label = (catalogUnit || '').toString().trim() || 'Pkts';
    const info = getUnitInfo(label);
    const abs = Math.abs(val);
    const plain = n => String(Number(n.toFixed(2)));

    if (info.family === 'mass') {
        if (abs >= 1000) return `${(val / 1000).toFixed(2)} Kg`;
        return val === 0 ? `0 ${label}` : `${plain(val)} gms`;
    }
    if (info.family === 'volume') {
        if (abs >= 1000) return `${(val / 1000).toFixed(2)} Ltrs`;
        return val === 0 ? `0 ${label}` : `${plain(val)} ml`;
    }
    return `${plain(val)} ${label}`;
}

// Resolve the unit defined in the SKU Catalog for an item.
// Catalog stores Raw Materials with `unit` (and measure='Pkts' as a placeholder),
// and Finished Inventory with `measure` (and unit='Pkts' as a placeholder).
function resolveCatalogUnit(sku, isRaw, fallbackUnit) {
    const pick = (...vals) => vals.map(v => (v || '').toString().trim()).find(Boolean);
    if (isRaw) {
        const u = pick(sku.unit);
        if (u) return u;
        // Legacy raw docs without `unit`: use measure only if it's a real unit, not the 'Pkts' placeholder
        const m = pick(sku.measure);
        if (m && m.toLowerCase() !== 'pkts') return m;
        return fallbackUnit || m || 'gms';
    }
    return pick(sku.measure, sku.unit) || 'Pkts';
}

const keyOf = s => (s || '').toString().trim().toLowerCase();

export function renderInventoryLedger() {
    const tbody = document.getElementById('inventory-table-body');
    const statTotalSkus = document.getElementById('stat-total-skus');
    const statLowStock = document.getElementById('stat-low-stock');
    const statValuation = document.getElementById('stat-inventory-val');
    const activeCountEl = document.getElementById('active-count');
    if (!tbody) return;

    const categoryFilter = document.getElementById('filter-category').value;
    const searchFilter = document.getElementById('filter-search').value.toLowerCase();

    // Build catalog lookup first (SKUs take priority over inventory docs)
    const allItems = [];
    const catalogByName = new Map();
    [...window.appData.skus, ...window.appData.inventory].forEach(item => {
        const k = keyOf(item.name);
        if (k && !catalogByName.has(k)) {
            catalogByName.set(k, item);
            allItems.push(item);
        }
    });

    // Procured raw material (normalized to gms / ml / count).
    // A purchase line's own unit wins; otherwise fall back to the catalog's unit for that item.
    const procuredMap = {};
    const lastPurchaseUnit = {};
    window.appData.purchases.forEach(po => {
        const items = po.items || po.lineItems || [];
        items.forEach(item => {
            const k = keyOf(item.name || item.item);
            if (!k) return;
            const catalogItem = catalogByName.get(k);
            const catIsRaw = catalogItem ? (catalogItem.type || catalogItem.category || 'Raw Material').toLowerCase().includes('raw') : true;
            const catUnit = catalogItem ? resolveCatalogUnit(catalogItem, catIsRaw, null) : null;
            const unit = (item.unit || '').toString().trim() || catUnit || 'gms';
            const qty = Number(item.qty || item.quantity) || 0;
            procuredMap[k] = (procuredMap[k] || 0) + normalizeQty(qty, unit);
            if (item.unit) lastPurchaseUnit[k] = item.unit;
        });
    });

    // Production batches -> finished goods (grams)
    const producedMap = {};
    window.appData.batches.forEach(b => {
        const k = keyOf(b.product || b.productLine);
        const grams = Number(b.totalGrams || b.weight || 0);
        producedMap[k] = (producedMap[k] || 0) + grams;
    });

    // Sales (finished goods sold, in sales units)
    const soldMap = {};
    window.appData.sales.forEach(sale => {
        const items = sale.items || sale.lineItems || [];
        items.forEach(item => {
            const k = keyOf(item.product || item.name);
            const qty = Number(item.qty || item.quantity) || 0;
            soldMap[k] = (soldMap[k] || 0) + qty;
        });
    });

    // Samples (marketing consumption)
    const sampleMap = {};
    window.appData.samples.forEach(s => {
        const k = keyOf(s.product || s.item);
        const qty = Number(s.qty || s.quantity) || 0;
        sampleMap[k] = (sampleMap[k] || 0) + qty;
    });

    const filtered = allItems.filter(sku => {
        const type = sku.type || sku.category || 'Raw Material';
        if (categoryFilter !== 'ALL' && !type.toLowerCase().includes(categoryFilter.toLowerCase())) return false;
        if (searchFilter && !sku.name.toLowerCase().includes(searchFilter)) return false;
        return true;
    });

    let lowStockCount = 0;
    let totalValuation = 0;

    const rowsHtml = filtered.map(sku => {
        const name = sku.name;
        const k = keyOf(name);
        const type = sku.type || sku.category || 'Raw Material';
        const cost = Number(sku.cost || sku.price || 0);
        const isRaw = type.toLowerCase().includes('raw');

        // Unit comes strictly from the SKU Catalog definition
        const catalogUnit = resolveCatalogUnit(sku, isRaw, lastPurchaseUnit[k]);
        const unitInfo = getUnitInfo(catalogUnit);

        let procured = 0;
        let consumed = 0;
        let netBalance = 0;
        let isLow = false;

        if (isRaw) {
            procured = procuredMap[k] || 0;
            consumed = 0;
            netBalance = procured - consumed;
            // Low stock: < 2 Kg / 2 Ltrs for weight/volume items, < 5 for count-based items
            const threshold = unitInfo.family === 'count' ? 5 : 2000;
            isLow = netBalance > 0 && netBalance < threshold;
        } else {
            const totalProducedGrams = producedMap[k] || 0;
            const gramsPerPkt = Number(sku.grams || sku.weight || 250);
            procured = gramsPerPkt > 0 ? (totalProducedGrams / gramsPerPkt) : totalProducedGrams;
            consumed = (soldMap[k] || 0) + (sampleMap[k] || 0);
            netBalance = procured - consumed;
            isLow = netBalance >= 0 && netBalance < 5;
        }
        if (isLow) lowStockCount++;

        // Valuation: cost is defined per catalog unit (per Kg, per Ltr, per Pkt...)
        const positive = netBalance > 0 ? netBalance : 0;
        const valuation = isRaw
            ? (positive / unitInfo.factor) * cost
            : positive * cost;
        totalValuation += valuation;

        const badgeClass = isRaw ? 'raw' : 'finished';

        let statusBadge = `<span class="status-badge" style="background: #dcfce7; color: #15803d; border: 1.5px solid #bbf7d0;">In Stock</span>`;
        if (netBalance <= 0 && procured === 0) {
            statusBadge = `<span class="status-badge" style="background: #f1f5f9; color: #64748b; border: 1.5px solid #cbd5e1;">Not Tracked</span>`;
        } else if (netBalance <= 0) {
            statusBadge = `<span class="status-badge" style="background: #fee2e2; color: #dc2626; border: 1.5px solid #fecaca;">Out of Stock</span>`;
        } else if (isLow) {
            statusBadge = `<span class="status-badge" style="background: #fef3c7; color: #b45309; border: 1.5px solid #fde68a;">Low Stock</span>`;
        }

        return `
            <tr>
                <td data-label="Item Name"><strong>${name}</strong></td>
                <td data-label="Category"><span class="status-badge ${badgeClass}">${type}</span></td>
                <td data-label="Total Procured">${formatDisplayQty(procured, catalogUnit)}</td>
                <td data-label="Total Consumed">${formatDisplayQty(consumed, catalogUnit)}</td>
                <td data-label="Net Balance"><strong>${formatDisplayQty(netBalance, catalogUnit)}</strong></td>
                <td data-label="Status">${statusBadge}</td>
                <td data-label="Action" style="text-align: right;">
                    <button class="btn-outline" style="padding: 6px 14px; font-size: 0.8rem; min-height: 34px; font-weight: 700;" onclick="location.href='purchase-log.html'">Reorder PO</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml.length ? rowsHtml.join('') : `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">No inventory items matched your filter criteria.</td></tr>`;

    if (statTotalSkus) statTotalSkus.innerText = allItems.length;
    if (statLowStock) statLowStock.innerText = lowStockCount;
    if (statValuation) statValuation.innerText = `₹${totalValuation.toFixed(2)}`;
    if (activeCountEl) activeCountEl.innerText = filtered.length;
}

export function clearInventoryFilter() {
    document.getElementById('filter-category').value = 'ALL';
    document.getElementById('filter-search').value = '';
    renderInventoryLedger();
}

window.clearInventoryFilter = clearInventoryFilter;
window.renderInventoryLedger = renderInventoryLedger;

document.addEventListener('DOMContentLoaded', () => {
    initInventoryTracker();
});