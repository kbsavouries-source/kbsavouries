import { 
    db, 
    appData, 
    loadCloudCollection, 
    saveDataDoc, 
    updateDataDoc, 
    deleteDataDoc, 
    defaultSKUs, 
    exportCSVData, 
    exportJSONData,
    customConfirm,
    customAlert 
} from './firebase-config.js';

// Initialize Tom Select on all selects
function initSearchableSelects() {
    if (typeof TomSelect === 'undefined') return;
    
    document.querySelectorAll('select:not([data-searchable-initialized])').forEach(el => {
        if (!el.id) return;
        try {
            new TomSelect(el, {
                create: false,
                sortField: { field: "text", direction: "asc" },
                maxOptions: 50
            });
            el.setAttribute('data-searchable-initialized', 'true');
        } catch (err) {
            console.warn("Tom Select initialization skipped for element", err);
        }
    });
}

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
};

// Helper to extract dynamic overhead rows from the form
function getOverheadsFromDOM() {
    const rows = document.querySelectorAll('#overhead-rows-container .overhead-row');
    const overheads = [];
    rows.forEach(r => {
        const name = r.querySelector('.overhead-name').value.trim();
        const cost = Number(r.querySelector('.overhead-cost').value) || 0;
        if (name) {
            overheads.push({ name, cost });
        }
    });
    return overheads;
}

// Render dynamic overhead row in the form
window.addOverheadRow = function(name = '', cost = '') {
    const container = document.getElementById('overhead-rows-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'overhead-row';
    row.style.cssText = 'display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 10px; border: 1.5px solid var(--glass-border);';

    row.innerHTML = `
        <input type="text" class="overhead-name" placeholder="Overhead Name (e.g. Pouch / Seal / Sticker)" value="${name}" style="flex: 2; height: 40px;" required>
        <input type="number" class="overhead-cost" placeholder="Cost (₹)" value="${cost !== '' ? cost : ''}" step="any" min="0" style="flex: 1; height: 40px;" required>
        <button type="button" class="btn-danger" onclick="this.parentElement.remove()" style="padding: 6px 14px; min-height: 40px; width: auto !important;">✕</button>
    `;
    container.appendChild(row);
};

// Calculate Total Overhead for an SKU Object
function calculateTotalOverhead(s) {
    if (s.type !== 'Finished Inventory' || !s.overheads) return 0;
    return s.overheads.reduce((sum, o) => sum + (Number(o.cost) || 0), 0);
}

// Render SKU Directory Table with Search Filtering
window.renderSKUs = function() {
    const tbody = document.getElementById('sku-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('sku-search-filter')?.value || "").toLowerCase().trim();

    // Filter SKUs based on name or classification
    const filteredSKUs = appData.skus.filter(s => {
        return s.name.toLowerCase().includes(searchTerm) || 
               s.type.toLowerCase().includes(searchTerm);
    });

    const sortedSKUs = [...filteredSKUs].sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'Finished Inventory' ? -1 : 1;
    });

    if (sortedSKUs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 24px;">No matching SKUs found.</td></tr>`;
        return;
    }

    tbody.innerHTML = sortedSKUs.map((s) => {
        const index = appData.skus.indexOf(s);
        const details = s.type === 'Finished Inventory' ? `${s.grams}g equivalent (${s.measure || 'Pkts'})` : `Preferred Unit: ${s.unit}`;
        const pricing = s.type === 'Finished Inventory' ? `₹${s.price}` : `-`;
        const badgeClass = s.type === 'Finished Inventory' ? 'finished' : 'raw';
        
        const totalOverhead = calculateTotalOverhead(s);
        const overheadsDisplay = s.type === 'Finished Inventory' ? `₹${totalOverhead.toFixed(2)}` : `-`;

        return `
            <tr>
                <td data-label="SKU Name"><strong>${s.name}</strong></td>
                <td data-label="Classification"><span class="status-badge ${badgeClass}">${s.type}</span></td>
                <td data-label="Details / Specs">${details}</td>
                <td data-label="Overheads / Unit"><strong style="color: var(--accent-orange);">${overheadsDisplay}</strong></td>
                <td data-label="Price / Unit">${pricing}</td>
                <td data-label="Action">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-outline" style="padding: 6px 12px; font-size: 0.8rem; min-height: 36px;" onclick="editSKUItem(${index})">Edit</button>
                        <button class="btn-danger" onclick="deleteSKUItem(${index})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// Clear SKU Search Filter
window.clearSKUFilter = function() {
    const searchInput = document.getElementById('sku-search-filter');
    if (searchInput) {
        searchInput.value = '';
    }
    renderSKUs();
};

// Add or Update SKU Form Submission
window.addSKU = async function(e) {
    e.preventDefault();
    const editIndex = document.getElementById('sku-edit-index').value;
    const name = document.getElementById('sku-name').value.trim();
    const type = document.getElementById('sku-type').value;

    if (editIndex === "") {
        if (appData.skus.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            await customAlert("Duplicate SKU", "An SKU with this name already exists.");
            return;
        }
    }

    const isFinished = type === 'Finished Inventory';

    const skuObj = {
        name: name,
        type: type,
        grams: isFinished ? Number(document.getElementById('sku-grams').value) || 0 : 0,
        price: isFinished ? Number(document.getElementById('sku-price').value) || 0 : 0,
        measure: isFinished ? document.getElementById('sku-measure').value : 'Pkts',
        unit: !isFinished ? document.getElementById('sku-unit').value : 'Pkts',
        overheads: isFinished ? getOverheadsFromDOM() : []
    };

    if (editIndex !== "") {
        const index = Number(editIndex);
        skuObj.firebaseId = appData.skus[index].firebaseId;
        appData.skus[index] = skuObj;

        if (skuObj.firebaseId) {
            await updateDataDoc('skus', skuObj.firebaseId, skuObj);
        }
        cancelSKUEdit();
    } else {
        appData.skus.push(skuObj);
        await saveDataDoc('skus', skuObj);
        document.getElementById('sku-form').reset();
        onSKUTypeChange(document.getElementById('sku-type'));
    }

    renderSKUs();
};

// Edit SKU
window.editSKUItem = function(index) {
    const sku = appData.skus[index];
    if (!sku) return;

    document.getElementById('sku-edit-index').value = index;
    document.getElementById('sku-name').value = sku.name;
    document.getElementById('sku-type').value = sku.type;
    onSKUTypeChange(document.getElementById('sku-type'));

    if (sku.type === 'Finished Inventory') {
        document.getElementById('sku-grams').value = sku.grams || 0;
        document.getElementById('sku-price').value = sku.price || 0;
        document.getElementById('sku-measure').value = sku.measure || 'Pkts';
        
        const container = document.getElementById('overhead-rows-container');
        container.innerHTML = '';
        if (sku.overheads && sku.overheads.length > 0) {
            sku.overheads.forEach(o => addOverheadRow(o.name, o.cost));
        } else {
            addOverheadRow('Packaging / Pouch', 0);
        }
    } else {
        document.getElementById('sku-unit').value = sku.unit || 'Kg';
    }

    document.getElementById('sku-form-title').innerText = `Edit SKU: ${sku.name}`;
    document.getElementById('sku-submit-btn').innerText = 'Update SKU';
    document.getElementById('sku-cancel-btn').style.display = 'inline-flex';

    document.getElementById('sku-form').scrollIntoView({ behavior: 'smooth' });
};

// Cancel SKU Editing
window.cancelSKUEdit = function() {
    document.getElementById('sku-edit-index').value = '';
    document.getElementById('sku-form').reset();
    onSKUTypeChange(document.getElementById('sku-type'));
    document.getElementById('sku-form-title').innerText = 'Create New SKU';
    document.getElementById('sku-submit-btn').innerText = 'Register SKU';
    document.getElementById('sku-cancel-btn').style.display = 'none';
    
    const container = document.getElementById('overhead-rows-container');
    if (container) {
        container.innerHTML = '';
        addOverheadRow('Packaging / Pouch', 0);
    }
};

// Update SKU Type Listener
window.onSKUTypeChange = function(selectEl) {
    const type = selectEl.value;
    const gramsGroup = document.getElementById('sku-grams-group');
    const priceGroup = document.getElementById('sku-price-group');
    const measureGroup = document.getElementById('sku-measure-group');
    const unitGroup = document.getElementById('sku-unit-group');
    const overheadSection = document.getElementById('overhead-section');
    const container = document.getElementById('overhead-rows-container');

    if (type === 'Finished Inventory') {
        gramsGroup.style.display = 'flex';
        priceGroup.style.display = 'flex';
        measureGroup.style.display = 'flex';
        unitGroup.style.display = 'none';
        if (overheadSection) overheadSection.style.display = 'block';
        if (container && container.children.length === 0) {
            addOverheadRow('Packaging / Pouch', 0);
        }
    } else {
        gramsGroup.style.display = 'none';
        priceGroup.style.display = 'none';
        measureGroup.style.display = 'none';
        unitGroup.style.display = 'flex';
        if (overheadSection) overheadSection.style.display = 'none';
    }
};

window.exportCSV = function(type) {
    exportCSVData(type);
};

window.exportJSON = function() {
    exportJSONData();
};

// Delete SKU Item with Glassmorphic Custom Modal Prompt
window.deleteSKUItem = async function(index) {
    const skuToDelete = appData.skus[index];
    if (!skuToDelete) return;

    const confirmed = await customConfirm(
        "Delete SKU?", 
        `Are you sure you want to delete "${skuToDelete.name}"?`
    );
    if (!confirmed) return;
    
    if (skuToDelete.firebaseId) {
        try {
            await deleteDataDoc('skus', skuToDelete.firebaseId);
        } catch (err) {
            console.error("Error deleting SKU from cloud:", err);
        }
    }
    
    appData.skus.splice(index, 1);
    renderSKUs();
};

// Page Load Lifecycle
document.addEventListener('DOMContentLoaded', async () => {
    const dateDisplay = document.getElementById('current-date');
    if (dateDisplay) {
        dateDisplay.innerText = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    await loadCloudCollection('skus');
    renderSKUs();
    initSearchableSelects();
    onSKUTypeChange(document.getElementById('sku-type'));
});