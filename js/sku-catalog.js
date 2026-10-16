import { 
    db, 
    appData, 
    loadCloudCollection, 
    saveDataDoc, 
    updateDataDoc, 
    deleteDataDoc, 
    exportCSVData, 
    exportJSONData,
    customConfirm,
    customAlert 
} from './firebase-config.js';

function initSearchableSelects() {
    if (typeof TomSelect === 'undefined') return;
    
    document.querySelectorAll('select:not(#sku-type):not([data-searchable-initialized])').forEach(el => {
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

function getOverheadsFromDOM() {
    const rows = document.querySelectorAll('#overhead-rows-container .overhead-row');
    const overheads = [];
    rows.forEach(r => {
        const nameInput = r.querySelector('.overhead-name');
        const costInput = r.querySelector('.overhead-cost');
        if (nameInput && costInput) {
            const name = nameInput.value.trim();
            const cost = Number(costInput.value) || 0;
            if (name) {
                overheads.push({ name, cost });
            }
        }
    });
    return overheads;
}

window.addOverheadRow = function(name = '', cost = '') {
    const container = document.getElementById('overhead-rows-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'overhead-row';
    row.style.cssText = 'display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 10px; border: 1.5px solid var(--glass-border);';

    row.innerHTML = `
        <input type="text" class="overhead-name" placeholder="Overhead Name (e.g. Pouch / Seal)" value="${name}" style="flex: 2; height: 40px;" required>
        <input type="number" class="overhead-cost" placeholder="Cost (₹)" value="${cost !== '' ? cost : ''}" step="any" min="0" style="flex: 1; height: 40px;" required>
        <button type="button" class="btn-danger" onclick="this.parentElement.remove()" style="padding: 6px 14px; min-height: 40px; width: auto !important;">✕</button>
    `;
    container.appendChild(row);
};

function calculateTotalOverhead(s) {
    if (s.type !== 'Finished Inventory' || !s.overheads) return 0;
    return s.overheads.reduce((sum, o) => sum + (Number(o.cost) || 0), 0);
}

function calculateExpiryDateStr(days) {
    const d = new Date();
    d.setDate(d.getDate() + (Number(days) || 0));
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function generateSKUNumber(type) {
    const isFinished = (type || '').toLowerCase().includes('finished');
    const prefix = isFinished ? 'SKU-FG-' : 'SKU-RM-';
    
    let maxNum = 1000;
    if (appData && appData.skus) {
        appData.skus.forEach(s => {
            const code = s.skuNo || '';
            if (code.startsWith(prefix)) {
                const numPart = parseInt(code.replace(prefix, ''), 10);
                if (!isNaN(numPart) && numPart > maxNum) {
                    maxNum = numPart;
                }
            }
        });
    }
    return `${prefix}${maxNum + 1}`;
}

window.renderSKUs = function() {
    const tbody = document.getElementById('sku-table-body');
    if (!tbody || !appData || !appData.skus) return;

    const searchTerm = (document.getElementById('sku-search-filter')?.value || "").toLowerCase().trim();

    const filteredSKUs = appData.skus.filter(s => {
        return (s.name || '').toLowerCase().includes(searchTerm) || 
               (s.type || '').toLowerCase().includes(searchTerm) ||
               (s.skuNo || '').toLowerCase().includes(searchTerm);
    });

    const sortedSKUs = [...filteredSKUs].sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'Finished Inventory' ? -1 : 1;
    });

    if (sortedSKUs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-secondary); padding: 24px;">No matching SKUs found.</td></tr>`;
        return;
    }

    tbody.innerHTML = sortedSKUs.map((s) => {
        const index = appData.skus.indexOf(s);
        const skuNo = s.skuNo || generateSKUNumber(s.type);
        
        let details = s.type === 'Finished Inventory' ? `${s.grams}g (${s.measure || 'Pkts'})` : `Unit: ${s.unit}`;
        
        if (s.type === 'Finished Inventory' && s.expiryDays) {
            const calculatedExpiry = calculateExpiryDateStr(s.expiryDays);
            details += ` • ${s.expiryDays}d (Exp: ${calculatedExpiry})`;
        }

        const pricing = s.type === 'Finished Inventory' ? `₹${s.price}` : `-`;
        const badgeClass = s.type === 'Finished Inventory' ? 'finished' : 'raw';
        const badgeText = s.type === 'Finished Inventory' ? 'FINISHED' : 'RAW MAT';
        
        const totalOverhead = calculateTotalOverhead(s);
        const overheadsDisplay = s.type === 'Finished Inventory' ? `₹${totalOverhead.toFixed(2)}` : `-`;

        return `
            <tr>
                <td data-label="SKU No."><code>${skuNo}</code></td>
                <td data-label="SKU Name"><strong>${s.name}</strong></td>
                <td data-label="Classification"><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td data-label="Details / Specs" class="specs-cell">${details}</td>
                <td data-label="Overheads"><strong style="color: var(--accent-orange);">${overheadsDisplay}</strong></td>
                <td data-label="Price">${pricing}</td>
                <td data-label="Action">
                    <div class="action-btn-group">
                        <button class="btn-outline" style="padding: 5px 10px; font-size: 0.78rem; min-height: 32px;" onclick="editSKUItem(${index})">Edit</button>
                        <button class="btn-danger" style="padding: 5px 10px; font-size: 0.78rem; min-height: 32px;" onclick="deleteSKUItem(${index})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.clearSKUFilter = function() {
    const searchInput = document.getElementById('sku-search-filter');
    if (searchInput) searchInput.value = '';
    renderSKUs();
};

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
        skuNo: editIndex !== "" ? appData.skus[Number(editIndex)].skuNo : generateSKUNumber(type),
        name: name,
        type: type,
        grams: isFinished ? Number(document.getElementById('sku-grams').value) || 0 : 0,
        price: isFinished ? Number(document.getElementById('sku-price').value) || 0 : 0,
        measure: isFinished ? document.getElementById('sku-measure').value : 'Pkts',
        expiryDays: isFinished ? Number(document.getElementById('sku-expiry-days').value) || 0 : 0,
        unit: !isFinished ? document.getElementById('sku-unit').value : 'Pkts',
        overheads: isFinished ? getOverheadsFromDOM() : []
    };

    if (editIndex !== "") {
        const index = Number(editIndex);
        // CRITICAL FIX: Preserve the firebaseId for proper cloud document updates
        const existingFirebaseId = appData.skus[index].firebaseId;
        if (existingFirebaseId) {
            skuObj.firebaseId = existingFirebaseId;
        }
        
        appData.skus[index] = skuObj;

        if (skuObj.firebaseId) {
            try {
                await updateDataDoc('skus', skuObj.firebaseId, skuObj);
            } catch (err) {
                console.error("Error updating SKU in cloud:", err);
            }
        }
        window.cancelSKUEdit();
    } else {
        appData.skus.push(skuObj);
        try {
            const docRef = await saveDataDoc('skus', skuObj);
            if (docRef && docRef.id) {
                skuObj.firebaseId = docRef.id;
            }
        } catch (err) {
            console.error("Error saving new SKU to cloud:", err);
        }
        
        document.getElementById('sku-form').reset();
        const typeSelect = document.getElementById('sku-type');
        typeSelect.value = "Finished Inventory";
        window.onSKUTypeChange(typeSelect);
    }

    renderSKUs();
};

window.editSKUItem = function(index) {
    const sku = appData.skus[index];
    if (!sku) return;

    document.getElementById('sku-edit-index').value = index;
    document.getElementById('sku-name').value = sku.name;
    
    const typeSelect = document.getElementById('sku-type');
    typeSelect.value = sku.type;
    window.onSKUTypeChange(typeSelect);

    if (sku.type === 'Finished Inventory') {
        document.getElementById('sku-grams').value = sku.grams || 0;
        document.getElementById('sku-price').value = sku.price || 0;
        
        const measureSelect = document.getElementById('sku-measure');
        measureSelect.value = sku.measure || 'Pkts';

        document.getElementById('sku-expiry-days').value = sku.expiryDays || 30;
        
        const container = document.getElementById('overhead-rows-container');
        container.innerHTML = '';
        if (sku.overheads && sku.overheads.length > 0) {
            sku.overheads.forEach(o => window.addOverheadRow(o.name, o.cost));
        } else {
            window.addOverheadRow('Packaging / Pouch', 0);
        }
    } else {
        const unitSelect = document.getElementById('sku-unit');
        unitSelect.value = sku.unit || 'Kg';
    }

    document.getElementById('sku-form-title').innerText = `Edit SKU: ${sku.name} (${sku.skuNo || ''})`;
    document.getElementById('sku-submit-btn').innerText = 'Update SKU';
    document.getElementById('sku-cancel-btn').style.display = 'inline-flex';

    document.getElementById('sku-form').scrollIntoView({ behavior: 'smooth' });
};

window.cancelSKUEdit = function() {
    document.getElementById('sku-edit-index').value = '';
    document.getElementById('sku-form').reset();
    
    const typeSelect = document.getElementById('sku-type');
    typeSelect.value = "Finished Inventory";
    window.onSKUTypeChange(typeSelect);

    document.getElementById('sku-form-title').innerText = 'Create New SKU';
    document.getElementById('sku-submit-btn').innerText = 'Register SKU';
    document.getElementById('sku-cancel-btn').style.display = 'none';
    
    const container = document.getElementById('overhead-rows-container');
    if (container) {
        container.innerHTML = '';
        window.addOverheadRow('Packaging / Pouch', 0);
    }
};

window.onSKUTypeChange = function(selectEl) {
    const type = selectEl ? selectEl.value : 'Finished Inventory';
    const gramsGroup = document.getElementById('sku-grams-group');
    const priceGroup = document.getElementById('sku-price-group');
    const measureGroup = document.getElementById('sku-measure-group');
    const expiryGroup = document.getElementById('sku-expiry-group');
    const unitGroup = document.getElementById('sku-unit-group');
    const overheadSection = document.getElementById('overhead-section');
    const container = document.getElementById('overhead-rows-container');

    if (type === 'Finished Inventory') {
        if (gramsGroup) gramsGroup.style.display = 'flex';
        if (priceGroup) priceGroup.style.display = 'flex';
        if (measureGroup) measureGroup.style.display = 'flex';
        if (expiryGroup) expiryGroup.style.display = 'flex';
        if (unitGroup) unitGroup.style.display = 'none';
        if (overheadSection) overheadSection.style.display = 'block';
        if (container && container.children.length === 0) {
            window.addOverheadRow('Packaging / Pouch', 0);
        }
    } else {
        if (gramsGroup) gramsGroup.style.display = 'none';
        if (priceGroup) priceGroup.style.display = 'none';
        if (measureGroup) measureGroup.style.display = 'none';
        if (expiryGroup) expiryGroup.style.display = 'none';
        if (unitGroup) unitGroup.style.display = 'flex';
        if (overheadSection) overheadSection.style.display = 'none';
    }
};

window.openBulkModal = function() {
    const modal = document.getElementById('bulk-import-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeBulkModal = function() {
    const modal = document.getElementById('bulk-import-modal');
    if (modal) modal.style.display = 'none';
    const fileInput = document.getElementById('csv-file-input');
    if (fileInput) fileInput.value = '';
    const label = document.getElementById('file-chosen-label');
    if (label) label.innerText = 'Choose CSV File...';
};

window.updateFileName = function(input) {
    const label = document.getElementById('file-chosen-label');
    if (input.files && input.files.length > 0) {
        label.innerText = input.files[0].name;
    } else {
        label.innerText = 'Choose CSV File...';
    }
};

window.downloadCSVTemplate = function() {
    const csvHeader = "skuNo,name,type,grams,price,measure,expiryDays,unit,overhead1Name,overhead1Amount,overhead2Name,overhead2Amount,overhead3Name,overhead3Amount,overhead4Name,overhead4Amount\n";
    const csvExample = ",Poha Crunch - 250g,Finished Inventory,250,50,Pkts,30,Pkts,Pouch,3,Sticker,1,,,,\n,Salt,Raw Material,0,0,Pkts,0,Kg,,,,,,,\n";
    const blob = new Blob([csvHeader + csvExample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kb_savouries_sku_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
};

window.processBulkCSV = async function() {
    const fileInput = document.getElementById('csv-file-input');
    if (!fileInput || fileInput.files.length === 0) {
        await customAlert("No File Selected", "Please select a CSV file to import.");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/).filter(l => l.trim() !== '');
        
        if (lines.length < 2) {
            await customAlert("Invalid File", "The uploaded CSV file is empty or missing data rows.");
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        let importedCount = 0;
        let duplicateCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i].split(',').map(val => val.trim());
            if (currentLine.length < headers.length) continue;

            const rowData = {};
            headers.forEach((h, idx) => {
                rowData[h] = currentLine[idx];
            });

            const name = rowData['name'];
            if (!name) continue;

            const exists = appData.skus.some(s => s.name.toLowerCase() === name.toLowerCase());
            if (exists) {
                duplicateCount++;
                continue;
            }

            const type = rowData['type'] || 'Finished Inventory';
            const isFinished = type.toLowerCase().includes('finished');
            const skuNo = rowData['skuno'] || rowData['sku_no'] || generateSKUNumber(type);

            let overheads = [];
            for (let c = 1; c <= 4; c++) {
                const ohName = rowData[`overhead${c}name`] || rowData[`overhead_${c}_name`];
                const ohAmt = rowData[`overhead${c}amount`] || rowData[`overhead_${c}_amount`];

                if (isFinished && ohName && ohName !== '') {
                    overheads.push({ name: ohName, cost: Number(ohAmt) || 0 });
                }
            }

            const skuObj = {
                skuNo: skuNo,
                name: name,
                type: isFinished ? 'Finished Inventory' : 'Raw Material',
                grams: Number(rowData['grams']) || (isFinished ? 100 : 0),
                price: Number(rowData['price']) || (isFinished ? 50 : 0),
                measure: rowData['measure'] || 'Pkts',
                expiryDays: Number(rowData['expirydays'] || rowData['expiry_days']) || 30,
                unit: rowData['unit'] || (isFinished ? 'Pkts' : 'Kg'),
                overheads: overheads
            };

            appData.skus.push(skuObj);
            try {
                const docRef = await saveDataDoc('skus', skuObj);
                if (docRef && docRef.id) {
                    skuObj.firebaseId = docRef.id;
                }
                importedCount++;
            } catch (err) {
                console.error("Error saving bulk SKU to cloud:", err);
            }
        }

        renderSKUs();
        window.closeBulkModal();
        await customAlert("Bulk Import Complete", `Successfully imported ${importedCount} SKUs (${duplicateCount} duplicates skipped).`);
    };

    reader.readAsText(file);
};

window.exportCSV = function(type) {
    exportCSVData(type);
};

window.exportJSON = function() {
    exportJSONData();
};

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
    const typeSelect = document.getElementById('sku-type');
    if (typeSelect) {
        typeSelect.value = "Finished Inventory";
        window.onSKUTypeChange(typeSelect);
    }
});