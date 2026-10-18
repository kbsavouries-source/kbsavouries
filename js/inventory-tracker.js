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
    inventory: [],
    boms: []
};

// Low stock: Net Available Balance strictly below this many base units (gms / ml)
const LOW_STOCK_BASE_UNITS = 500;
// Count-based raw materials (Pkts / Units / Pcs) have no gms/ml equivalent
const LOW_STOCK_COUNT_UNITS = 5;

export async function initInventoryTracker() {
    try {
        // Raw-material ledger only needs: catalog, purchases, batches (for BOM usage) and BOMs
        const collections = ['skus', 'inventory', 'purchases', 'batches', 'boms'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for inventory tracker:", err);
    }

    setupItemFilter();
    renderInventoryLedger();
}

/* ==========================================================================
   UNIT HANDLING
   Mass   -> base unit: gms  (1 Kg   = 1000 gms)
   Volume -> base unit: ml   (1 Ltr  = 1000 ml)
   Count  -> Pkts / Units / Pieces / Boxes (no conversion)
   ========================================================================== */
const UNIT_TABLE = {
    kg: { family: 'mass', factor: 1000 }, kgs: { family: 'mass', factor: 1000 },
    kilogram: { family: 'mass', factor: 1000 }, kilograms: { family: 'mass', factor: 1000 },
    g: { family: 'mass', factor: 1 }, gm: { family: 'mass', factor: 1 }, gms: { family: 'mass', factor: 1 },
    gram: { family: 'mass', factor: 1 }, grams: { family: 'mass', factor: 1 },
    l: { family: 'volume', factor: 1000 }, lt: { family: 'volume', factor: 1000 },
    ltr: { family: 'volume', factor: 1000 }, ltrs: { family: 'volume', factor: 1000 },
    liter: { family: 'volume', factor: 1000 }, liters: { family: 'volume', factor: 1000 },
    litre: { family: 'volume', factor: 1000 }, litres: { family: 'volume', factor: 1000 },
    ml: { family: 'volume', factor: 1 }, mls: { family: 'volume', factor: 1 }
};

function getUnitInfo(unit) {
    const key = String(unit || '').trim().toLowerCase().replace(/\./g, '');
    return UNIT_TABLE[key] || { family: 'count', factor: 1 };
}

function normalizeQty(qty, unit) {
    return (Number(qty) || 0) * getUnitInfo(unit).factor;
}

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

// Raw Materials store their real unit in `unit` (measure is a 'Pkts' placeholder).
function resolveRawUnit(sku, fallbackUnit) {
    const pick = (...vals) => vals.map(v => (v || '').toString().trim()).find(Boolean);
    const u = pick(sku.unit);
    if (u) return u;
    const m = pick(sku.measure);
    if (m && m.toLowerCase() !== 'pkts') return m;
    return fallbackUnit || m || 'gms';
}

/* ==========================================================================
   NAME MATCHING HELPERS
   ========================================================================== */
const keyOf = s => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
const lineOf = name => keyOf(String(name || '').split(' - ')[0]);

function lineMatches(a, b) {
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
}

// Raw Material only. Items with no type/category are treated as raw (legacy docs);
// anything labelled Finished Inventory / finished goods / packaging etc. is excluded.
const isRawType = item => (item.type || item.category || 'Raw Material').toString().toLowerCase().includes('raw');

// Unique list of raw material items from the catalog (SKUs take priority over inventory docs)
function getRawMaterials() {
    const seen = new Map();
    [...window.appData.skus, ...window.appData.inventory].forEach(item => {
        const k = keyOf(item.name);
        if (k && isRawType(item) && !seen.has(k)) seen.set(k, item);
    });
    return Array.from(seen.values());
}

/* ==========================================================================
   SEARCHABLE RAW MATERIAL DROPDOWN (Tom Select)
   ========================================================================== */
function setupItemFilter() {
    const select = document.getElementById('filter-item');
    if (!select) return;

    const names = getRawMaterials().map(r => r.name).sort((a, b) => a.localeCompare(b));
    select.innerHTML = `<option value="">All Raw Materials</option>` +
        names.map(n => `<option value="${String(n).replace(/"/g, '&quot;')}">${n}</option>`).join('');

    select.addEventListener('change', renderInventoryLedger);

    if (window.TomSelect && !select.tomselect) {
        new TomSelect(select, {
            create: false,
            allowEmptyOption: true,
            placeholder: 'Search raw material...',
            maxOptions: null,
            sortField: { field: '$order' }   // keep "All Raw Materials" first, then alphabetical order
        });
    }
}

export function renderInventoryLedger() {
    const tbody = document.getElementById('inventory-table-body');
    const statTotalSkus = document.getElementById('stat-total-skus');
    const statLowStock = document.getElementById('stat-low-stock');
    const statValuation = document.getElementById('stat-inventory-val');
    const activeCountEl = document.getElementById('active-count');
    if (!tbody) return;

    const itemSelect = document.getElementById('filter-item');
    const selectedItemKey = itemSelect ? keyOf(itemSelect.value) : '';

    // ---- Raw materials only ----
    const rawItems = getRawMaterials();
    const catalogByName = new Map(rawItems.map(r => [keyOf(r.name), r]));

    function resolveRawKey(name) {
        const k = keyOf(name);
        if (catalogByName.has(k)) return k;
        const hits = rawItems.filter(r => {
            const rk = keyOf(r.name);
            return rk.includes(k) || k.includes(rk);
        });
        return hits.length === 1 ? keyOf(hits[0].name) : k;
    }

    const catalogUnitFor = key => {
        const it = catalogByName.get(key);
        return it ? resolveRawUnit(it, null) : null;
    };

    // ---- Procured (purchases), normalized to gms / ml / count ----
    const procuredMap = {};
    const lastPurchaseUnit = {};
    window.appData.purchases.forEach(po => {
        (po.items || po.lineItems || []).forEach(item => {
            const k = resolveRawKey(item.name || item.item);
            if (!k) return;
            const unit = (item.unit || '').toString().trim() || catalogUnitFor(k) || 'gms';
            procuredMap[k] = (procuredMap[k] || 0) + normalizeQty(item.qty || item.quantity, unit);
            if (item.unit) lastPurchaseUnit[k] = item.unit;
        });
    });

    // ---- Consumed (production batches x BOM recipes) ----
    const consumedMap = {};
    const batchesWithoutBom = new Set();
    window.appData.batches.forEach(b => {
        const batchLine = lineOf(b.product || b.productLine);
        const batchGrams = Number(b.totalGrams || b.weight) || 0;
        if (!batchLine || batchGrams <= 0) return;

        const boms = window.appData.boms;
        const bom = boms.find(m => lineOf(m.productLine) === batchLine)
                 || boms.find(m => lineMatches(lineOf(m.productLine), batchLine));
        if (!bom || !Array.isArray(bom.ingredients) || !(Number(bom.baseOutputGrams) > 0)) {
            batchesWithoutBom.add(b.product || b.productLine);
            return;
        }

        const ratio = batchGrams / Number(bom.baseOutputGrams);
        bom.ingredients.forEach(ing => {
            const k = resolveRawKey(ing.name);
            if (!k) return;
            const unit = (ing.unit || '').toString().trim() || catalogUnitFor(k) || 'gms';
            consumedMap[k] = (consumedMap[k] || 0) + normalizeQty((Number(ing.qty) || 0) * ratio, unit);
        });
    });
    if (batchesWithoutBom.size) {
        console.warn("Inventory Tracker: no BOM found, raw material consumption not deducted for:", [...batchesWithoutBom]);
    }

    // ---- Dropdown filter ----
    const filtered = rawItems.filter(item => !selectedItemKey || keyOf(item.name) === selectedItemKey);

    let lowStockCount = 0;
    let totalValuation = 0;

    // Stats cover the whole raw-material catalog; the table respects the dropdown filter
    const rows = rawItems.map(sku => {
        const k = keyOf(sku.name);
        const cost = Number(sku.cost || sku.price || 0);
        const catalogUnit = resolveRawUnit(sku, lastPurchaseUnit[k]);
        const unitInfo = getUnitInfo(catalogUnit);

        const procured = procuredMap[k] || 0;
        const consumed = consumedMap[k] || 0;
        const netBalance = procured - consumed;

        const threshold = unitInfo.family === 'count' ? LOW_STOCK_COUNT_UNITS : LOW_STOCK_BASE_UNITS;
        const isLow = netBalance > 0 && netBalance < threshold;
        if (isLow) lowStockCount++;

        totalValuation += (Math.max(netBalance, 0) / unitInfo.factor) * cost;

        return { sku, k, catalogUnit, procured, consumed, netBalance, isLow };
    });

    const rowsHtml = rows
        .filter(r => !selectedItemKey || r.k === selectedItemKey)
        .map(r => {
            let statusBadge = `<span class="status-badge" style="background: #dcfce7; color: #15803d; border: 1.5px solid #bbf7d0;">In Stock</span>`;
            if (r.netBalance <= 0 && r.procured === 0 && r.consumed === 0) {
                statusBadge = `<span class="status-badge" style="background: #f1f5f9; color: #64748b; border: 1.5px solid #cbd5e1;">Not Tracked</span>`;
            } else if (r.netBalance <= 0) {
                statusBadge = `<span class="status-badge" style="background: #fee2e2; color: #dc2626; border: 1.5px solid #fecaca;">Out of Stock</span>`;
            } else if (r.isLow) {
                statusBadge = `<span class="status-badge" style="background: #fef3c7; color: #b45309; border: 1.5px solid #fde68a;">Low Stock</span>`;
            }

            return `
                <tr>
                    <td data-label="Raw Material"><strong>${r.sku.name}</strong></td>
                    <td data-label="Total Procured">${formatDisplayQty(r.procured, r.catalogUnit)}</td>
                    <td data-label="Total Consumed">${formatDisplayQty(r.consumed, r.catalogUnit)}</td>
                    <td data-label="Net Balance"><strong>${formatDisplayQty(r.netBalance, r.catalogUnit)}</strong></td>
                    <td data-label="Status">${statusBadge}</td>
                    <td data-label="Action" style="text-align: right;">
                        <button class="btn-outline" style="padding: 6px 14px; font-size: 0.8rem; min-height: 34px; font-weight: 700;" onclick="location.href='purchase-log.html'">Reorder PO</button>
                    </td>
                </tr>
            `;
        });

    tbody.innerHTML = rowsHtml.length
        ? rowsHtml.join('')
        : `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">No raw materials matched your filter.</td></tr>`;

    if (statTotalSkus) statTotalSkus.innerText = rawItems.length;
    if (statLowStock) statLowStock.innerText = lowStockCount;
    if (statValuation) statValuation.innerText = `₹${totalValuation.toFixed(2)}`;
    if (activeCountEl) activeCountEl.innerText = filtered.length;
}

export function clearInventoryFilter() {
    const select = document.getElementById('filter-item');
    if (select) {
        if (select.tomselect) select.tomselect.clear(true); // silent, we re-render below
        select.value = '';
    }
    renderInventoryLedger();
}

window.clearInventoryFilter = clearInventoryFilter;
window.renderInventoryLedger = renderInventoryLedger;

document.addEventListener('DOMContentLoaded', () => {
    initInventoryTracker();
});