import { 
    db, 
    appData, 
    loadCloudCollection, 
    saveDataDoc, 
    updateDataDoc, 
    deleteDataDoc, 
    defaultSKUs, 
    exportCSVData, 
    exportJSONData 
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

// Passcode verification
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
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
};

// SKU Classification Change Listener
window.onSKUTypeChange = function(selectEl) {
    const type = selectEl.value;
    const gramsGroup = document.getElementById('sku-grams-group');
    const priceGroup = document.getElementById('sku-price-group');
    const measureGroup = document.getElementById('sku-measure-group');
    const unitGroup = document.getElementById('sku-unit-group');

    if (type === 'Finished Inventory') {
        gramsGroup.style.display = 'flex';
        priceGroup.style.display = 'flex';
        measureGroup.style.display = 'flex';
        unitGroup.style.display = 'none';
    } else {
        gramsGroup.style.display = 'none';
        priceGroup.style.display = 'none';
        measureGroup.style.display = 'none';
        unitGroup.style.display = 'flex';
    }
};

// Render SKU Directory Table
function renderSKUs() {
    const tbody = document.getElementById('sku-table-body');
    if (!tbody) return;

    const sortedSKUs = [...appData.skus].sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'Finished Inventory' ? -1 : 1;
    });

    tbody.innerHTML = sortedSKUs.map((s) => {
        const index = appData.skus.indexOf(s);
        let details = s.type === 'Finished Inventory' ? `${s.grams}g equivalent (${s.measure || 'Pkts'})` : `Preferred Unit: ${s.unit}`;
        let pricing = s.type === 'Finished Inventory' ? `₹${s.price}` : `-`;
        let badgeClass = s.type === 'Finished Inventory' ? 'finished' : 'raw';

        return `
            <tr>
                <td data-label="SKU Name"><strong>${s.name}</strong></td>
                <td data-label="Classification"><span class="status-badge ${badgeClass}">${s.type}</span></td>
                <td data-label="Details / Specs">${details}</td>
                <td data-label="Price / Unit">${pricing}</td>
                <td data-label="Action">
                    <button class="btn-outline" style="padding: 6px 12px; font-size: 0.8rem; min-height: 36px;" onclick="editSKUItem(${index})">Edit</button>
                    <button class="btn-danger" onclick="deleteSKUItem(${index})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Add or Update SKU Form Submission
window.addSKU = async function(e) {
    e.preventDefault();
    const editIndex = document.getElementById('sku-edit-index').value;
    const name = document.getElementById('sku-name').value.trim();
    const type = document.getElementById('sku-type').value;

    if (editIndex === "") {
        if (appData.skus.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            alert("An SKU with this name already exists.");
            return;
        }
    }

    const skuObj = {
        name: name,
        type: type,
        grams: type === 'Finished Inventory' ? Number(document.getElementById('sku-grams').value) || 0 : 0,
        price: type === 'Finished Inventory' ? Number(document.getElementById('sku-price').value) || 0 : 0,
        measure: type === 'Finished Inventory' ? document.getElementById('sku-measure').value : 'Pkts',
        unit: type === 'Raw Material' ? document.getElementById('sku-unit').value : 'Pkts'
    };

    if (editIndex !== "") {
        const index = Number(editIndex);
        skuObj.firebaseId = appData.skus[index].firebaseId;
        appData.skus[index] = skuObj;

        if (skuObj.firebaseId) {
            await updateDataDoc('skus', skuObj.firebaseId, {
                name: skuObj.name,
                type: skuObj.type,
                grams: skuObj.grams,
                price: skuObj.price,
                measure: skuObj.measure,
                unit: skuObj.unit
            });
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
        document.getElementById('sku-grams').value = sku.grams;
        document.getElementById('sku-price').value = sku.price;
        document.getElementById('sku-measure').value = sku.measure || 'Pkts';
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
    document.getElementById('sku-form-title').innerText = 'Create New SKU (Raw Material or Finished Inventory)';
    document.getElementById('sku-submit-btn').innerText = 'Register SKU';
    document.getElementById('sku-cancel-btn').style.display = 'none';
};

// Delete SKU
window.deleteSKUItem = async function(index) {
    if (!confirm("Are you sure you want to delete this SKU?")) return;
    const skuToDelete = appData.skus[index];
    await deleteDataDoc('skus', skuToDelete.firebaseId);
    appData.skus.splice(index, 1);
    renderSKUs();
};

window.exportCSV = function(type) {
    exportCSVData(type);
};

window.exportJSON = function() {
    exportJSONData();
};

// Page Load Lifecycle
document.addEventListener('DOMContentLoaded', async () => {
    if (sessionStorage.getItem('kb_authenticated') === 'true') {
        const modal = document.getElementById('passcode-modal');
        if (modal) modal.style.display = 'none';
    }

    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    await loadCloudCollection('skus', defaultSKUs);
    renderSKUs();
    initSearchableSelects();
});