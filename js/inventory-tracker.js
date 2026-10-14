// ==========================================================================
// Inventory Tracker Module Logic (Searchable Product Filter & BOM Scaling)
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

// Fallback default recipe per 500g output
const defaultRecipePer500g = [
    { name: "Poha", qty: 250, unit: "gms", category: "Raw Food Ingredient" },
    { name: "Peanut", qty: 63, unit: "gms", category: "Raw Food Ingredient" },
    { name: "Roasted Channa", qty: 63, unit: "gms", category: "Raw Food Ingredient" },
    { name: "Rice Bran Oil", qty: 500, unit: "ml", category: "Raw Food Ingredient" },
    { name: "Curry Leaves", qty: 10, unit: "gms", category: "Raw Food Ingredient" },
    { name: "Turmeric", qty: 5, unit: "gms", category: "Raw Food Ingredient" },
    { name: "Chilli Powder", qty: 1.5, unit: "gms", category: "Raw Food Ingredient" },
    { name: "Salt", qty: 1.5, unit: "gms", category: "Raw Food Ingredient" }
];

export function normalizeIngredientName(rawName) {
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

    // 1. Accumulate total purchases for all items
    let purchasedMap = {};
    (window.appData.purchases || []).forEach(p => {
        let masterName = normalizeIngredientName(p.item);
        let qty = Number(p.qty) || 0;
        let unit = (p.unit || 'Kg').toLowerCase();
        let qtyInBase = (unit === 'kg' || unit === 'ltrs') ? qty * 1000 : qty;

        if (!purchasedMap[masterName]) purchasedMap[masterName] = 0;
        purchasedMap[masterName] += qtyInBase;
    });

    // 2. Compute consumption dynamically based on product BOMs & scale factor
    let consumedMap = {};
    (window.appData.batches || []).forEach(b => {
        if (productFilter !== 'ALL' && b.product !== productFilter) return;

        let batchGrams = Number(b.totalGrams) || 0;
        
        let bomRecord = (window.appData.boms || []).find(item => item.productLine === b.product);
        let baseOutput = bomRecord ? Number(bomRecord.baseOutputGrams) || 500 : 500;
        let ingredientsList = bomRecord ? bomRecord.ingredients : defaultRecipePer500g;

        let scaleFactor = batchGrams / baseOutput;

        ingredientsList.forEach(ing => {
            let masterName = normalizeIngredientName(ing.name || ing.ingredient);
            let consumedAmt = Number(ing.qty) * scaleFactor;
            consumedMap[masterName] = (consumedMap[masterName] || 0) + consumedAmt;
        });
    });

    // 3. Determine which ingredients to show based on filter selection
    let ingredientsToDisplay = [];
    if (productFilter === 'ALL') {
        let allSet = new Set(defaultRecipePer500g.map(i => i.name));
        (window.appData.boms || []).forEach(b => b.ingredients.forEach(i => allSet.add(i.name)));
        ingredientsToDisplay = [...allSet];
    } else {
        let bomRecord = (window.appData.boms || []).find(item => item.productLine === productFilter);
        if (bomRecord && bomRecord.ingredients) {
            ingredientsToDisplay = bomRecord.ingredients.map(i => i.name);
        } else {
            ingredientsToDisplay = defaultRecipePer500g.map(i => i.name);
        }
    }

    let rowsHtml = [];

    ingredientsToDisplay.forEach(item => {
        let bomRef = defaultRecipePer500g.find(i => i.name === item) || { unit: 'gms', category: 'Raw Food Ingredient' };
        let prefUnit = bomRef.unit;
        let category = bomRef.category;

        let totalBought = purchasedMap[item] || 0;
        let totalUsed = consumedMap[item] || 0;
        let balance = totalBought - totalUsed;

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

    tbody.innerHTML = rowsHtml.length > 0 ? rowsHtml.join('') : `<tr><td colspan="6" style="text-align:center; padding: 20px;">No BOM configuration found for this product.</td></tr>`;
}

export function exportCSV(type) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (type === 'inventory') {
        let csvContent = "data:text/csv;charset=utf-8,Raw Ingredient,Category,Total Purchased,Consumed (Batches),Current Balance Stock,Stock Level Status\n";
        
        let purchasedMap = {};
        (window.appData.purchases || []).forEach(p => {
            let m = normalizeIngredientName(p.item);
            let q = Number(p.qty) || 0;
            if (!purchasedMap[m]) purchasedMap[m] = 0;
            purchasedMap[m] += (p.unit && (p.unit.toLowerCase() === 'kg' || p.unit.toLowerCase() === 'ltrs')) ? q * 1000 : q;
        });

        let consumedMap = {};
        const productFilter = productFilterTomSelect ? productFilterTomSelect.getValue() : 'ALL';
        
        (window.appData.batches || []).forEach(b => {
            if (productFilter !== 'ALL' && b.product !== productFilter) return;
            let bomRecord = (window.appData.boms || []).find(item => item.productLine === b.product);
            let baseOutput = bomRecord ? Number(bomRecord.baseOutputGrams) || 500 : 500;
            let ingredientsList = bomRecord ? bomRecord.ingredients : defaultRecipePer500g;
            let batchScale = (Number(b.totalGrams) || 0) / baseOutput;

            ingredientsList.forEach(ing => {
                let m = normalizeIngredientName(ing.name || ing.ingredient);
                consumedMap[m] = (consumedMap[m] || 0) + (Number(ing.qty) * batchScale);
            });
        });

        let ingredientsToExport = [];
        if (productFilter === 'ALL') {
            let allSet = new Set(defaultRecipePer500g.map(i => i.name));
            (window.appData.boms || []).forEach(b => b.ingredients.forEach(i => allSet.add(i.name)));
            ingredientsToExport = [...allSet];
        } else {
            let bomRecord = (window.appData.boms || []).find(item => item.productLine === productFilter);
            ingredientsToExport = bomRecord ? bomRecord.ingredients.map(i => i.name) : defaultRecipePer500g.map(i => i.name);
        }

        ingredientsToExport.forEach(item => {
            let bomRef = defaultRecipePer500g.find(i => i.name === item) || { unit: 'gms', category: 'Raw Food Ingredient' };
            let totalBought = purchasedMap[item] || 0;
            let totalUsed = consumedMap[item] || 0;
            let bal = totalBought - totalUsed;
            let statusTag = bal <= 500 ? 'Low Stock' : 'Optimal';

            csvContent += `"${item}","${bomRef.category}","${formatDynamicValue(totalBought, bomRef.unit)}","${formatDynamicValue(totalUsed, bomRef.unit)}","${formatDynamicValue(bal, bomRef.unit)}","${statusTag}"\n`;
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