// ==========================================================================
// Inventory Tracker Module Logic
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
    batches: []
};

// Universal Recipe BOM proportions per 500g output
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
        const collections = ['skus', 'purchases', 'batches'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for inventory tracker:", err);
    }

    renderInventory();
}

export function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody || !window.appData) return;

    let purchasedMap = {};
    (window.appData.purchases || []).forEach(p => {
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
    (window.appData.batches || []).forEach(b => {
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

export function exportCSV(type) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (type === 'inventory') {
        let csvContent = "data:text/csv;charset=utf-8,Raw Ingredient,Category,Total Purchased,Consumed (Batches),Current Balance Stock,Stock Level Status\n";
        
        let purchasedMap = {};
        (window.appData.purchases || []).forEach(p => {
            let m = normalizeIngredientName(p.item);
            if (!defaultRecipePer500g[m]) return;
            let q = Number(p.qty) || 0;
            if (!purchasedMap[m]) purchasedMap[m] = { total: 0, unit: defaultRecipePer500g[m].unit };
            purchasedMap[m].total += (p.unit && (p.unit.toLowerCase() === 'kg' || p.unit.toLowerCase() === 'ltrs')) ? q * 1000 : q;
        });

        let consumedMap = {};
        (window.appData.batches || []).forEach(b => {
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
    }
}

// Bind functions to window scope for inline HTML event handling
window.renderInventory = renderInventory;
window.exportCSV = exportCSV;

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initInventoryTracker();
});