// ==========================================================================
// Inventory Tracker Module Logic (100% Dynamic SKU & BOM Driven)
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

export function formatDynamicValue(val, preferredUnit) {
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

    populateProductFilterDropdown();
    renderInventory();
}

let productFilterTomSelect = null;

export function populateProductFilterDropdown() {
    const filterSelect = document.getElementById('inventory-product-filter');
    const finishedSKUs = window.appData.skus.filter(s => s.type === 'Finished Inventory');

    if (filterSelect) {
        const uniqueProductLines = [...new Set(finishedSKUs.map(s => {
            return s.name.includes(' - ') ? s.name.split(' - ')[0].trim() : s.name;
        }))];

        filterSelect.innerHTML = `<option value="ALL">All Products (Combined)</option>` + 
            uniqueProductLines.map(line => `<option value="${line}">${line}</option>`).join('');

        if (window.TomSelect) {
            if (productFilterTomSelect) {
                productFilterTomSelect.destroy();
            }
            productFilterTomSelect = new TomSelect(filterSelect, {
                create: false,
                sortField: { field: "text", direction: "asc" },
                onChange: () => {
                    renderInventory();
                }
            });
        }
    }
}

export function clearInventoryFilter() {
    if (productFilterTomSelect) {
        productFilterTomSelect.setValue('ALL');
    } else {
        const filterSelect = document.getElementById('inventory-product-filter');
        if (filterSelect) filterSelect.value = 'ALL';
    }
    renderInventory();
}

export function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    const productFilter = productFilterTomSelect ? productFilterTomSelect.getValue() : 
                          (document.getElementById('inventory-product-filter') ? document.getElementById('inventory-product-filter').value : 'ALL');
    
    if (!tbody || !window.appData) return;

    // 1. Accumulate total purchases for all items based on Raw Material SKUs
    let purchasedMap = {};
    (window.appData.purchases || []).forEach(p => {
        let itemKey = p.item.trim().toLowerCase();
        let qty = Number(p.qty) || 0;
        let unit = (p.unit || '').toLowerCase();
        
        // Convert base purchase units for standard accumulation
        let qtyInBase = (unit === 'kg' || unit === 'ltrs') ? qty * 1000 : qty;

        if (!purchasedMap[itemKey]) purchasedMap[itemKey] = 0;
        purchasedMap[itemKey] += qtyInBase;
    });

    // 2. Compute consumption dynamically based on product BOMs & scale factor
    let consumedMap = {};
    (window.appData.batches || []).forEach(b => {
        if (productFilter !== 'ALL' && b.product !== productFilter) return;

        let batchGrams = Number(b.totalGrams) || 0;
        let bomRecord = (window.appData.boms || []).find(item => item.productLine === b.product);
        
        if (!bomRecord || !bomRecord.ingredients) return; // Skip if no BOM mapped

        let baseOutput = Number(bomRecord.baseOutputGrams) || 500;
        let scaleFactor = batchGrams / baseOutput;

        bomRecord.ingredients.forEach(ing => {
            let itemKey = ing.name.trim().toLowerCase();
            let ingredientQtyGrams = ing.unit.toLowerCase() === 'kg' || ing.unit.toLowerCase() === 'ltrs' ? Number(ing.qty) * 1000 : Number(ing.qty);
            let consumedAmt = ingredientQtyGrams * scaleFactor;
            
            consumedMap[itemKey] = (consumedMap[itemKey] || 0) + consumedAmt;
        });
    });

    // 3. Get all Raw Material SKUs dynamically from SKU Catalog
    const rawMaterialSKUs = window.appData.skus.filter(s => s.type === 'Raw Material');

    let rowsHtml = [];

    rawMaterialSKUs.forEach(sku => {
        let itemName = sku.name;
        let itemKey = itemName.toLowerCase();
        let prefUnit = sku.unit || 'gms';
        let category = 'Raw Material SKU';

        let totalBought = purchasedMap[itemKey] || 0;
        let totalUsed = consumedMap[itemKey] || 0;
        let balance = totalBought - totalUsed;

        let displayBought = formatDynamicValue(totalBought, prefUnit);
        let displayUsed = formatDynamicValue(totalUsed, prefUnit);
        let displayBalance = formatDynamicValue(balance, prefUnit);

        let isLow = balance <= 500;
        let statusTag = isLow ? '⚠️ Low Stock' : 'Optimal';
        let alertStyle = isLow ? 'color: #dc2626; font-weight: 700;' : '';

        rowsHtml.push(`
            <tr>
                <td data-label="Raw Ingredient"><strong>${itemName}</strong></td>
                <td data-label="Category">${category}</td>
                <td data-label="Total Purchased">${displayBought}</td>
                <td data-label="Consumed (Batches)">${displayUsed}</td>
                <td data-label="Current Balance Stock"><strong style="${alertStyle}">${displayBalance}</strong></td>
                <td data-label="Stock Level Status"><span class="status-badge" style="${alertStyle}">${statusTag}</span></td>
            </tr>
        `);
    });

    tbody.innerHTML = rowsHtml.length > 0 ? rowsHtml.join('') : `<tr><td colspan="6" style="text-align:center; padding: 20px;">No Raw Material SKUs found. Please register raw materials in the SKU Catalog.</td></tr>`;
}

export function exportCSV(type) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (type === 'inventory') {
        let csvContent = "data:text/csv;charset=utf-8,Raw Ingredient,Category,Total Purchased,Consumed (Batches),Current Balance Stock,Stock Level Status\n";
        
        let purchasedMap = {};
        (window.appData.purchases || []).forEach(p => {
            let itemKey = p.item.trim().toLowerCase();
            let q = Number(p.qty) || 0;
            let unit = (p.unit || '').toLowerCase();
            if (!purchasedMap[itemKey]) purchasedMap[itemKey] = 0;
            purchasedMap[itemKey] += (unit === 'kg' || unit === 'ltrs') ? q * 1000 : q;
        });

        let consumedMap = {};
        const productFilter = productFilterTomSelect ? productFilterTomSelect.getValue() : 'ALL';
        
        (window.appData.batches || []).forEach(b => {
            if (productFilter !== 'ALL' && b.product !== productFilter) return;
            let bomRecord = (window.appData.boms || []).find(item => item.productLine === b.product);
            if (!bomRecord || !bomRecord.ingredients) return;
            
            let baseOutput = Number(bomRecord.baseOutputGrams) || 500;
            let batchScale = (Number(b.totalGrams) || 0) / baseOutput;

            bomRecord.ingredients.forEach(ing => {
                let itemKey = ing.name.trim().toLowerCase();
                let qtyGrams = ing.unit.toLowerCase() === 'kg' || ing.unit.toLowerCase() === 'ltrs' ? Number(ing.qty) * 1000 : Number(ing.qty);
                consumedMap[itemKey] = (consumedMap[itemKey] || 0) + (qtyGrams * batchScale);
            });
        });

        const rawMaterialSKUs = window.appData.skus.filter(s => s.type === 'Raw Material');

        rawMaterialSKUs.forEach(sku => {
            let itemName = sku.name;
            let itemKey = itemName.toLowerCase();
            let prefUnit = sku.unit || 'gms';
            
            let totalBought = purchasedMap[itemKey] || 0;
            let totalUsed = consumedMap[itemKey] || 0;
            let bal = totalBought - totalUsed;
            let statusTag = bal <= 500 ? 'Low Stock' : 'Optimal';

            csvContent += `"${itemName}","Raw Material SKU","${formatDynamicValue(totalBought, prefUnit)}","${formatDynamicValue(totalUsed, prefUnit)}","${formatDynamicValue(bal, prefUnit)}","${statusTag}"\n`;
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
}

window.renderInventory = renderInventory;
window.clearInventoryFilter = clearInventoryFilter;
window.exportCSV = exportCSV;

document.addEventListener('DOMContentLoaded', () => {
    initInventoryTracker();
});