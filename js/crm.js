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

let editingIndex = null;

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

// Render Customer Directory Table with Search Filtering
window.renderCustomers = function() {
    const tbody = document.getElementById('crm-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('crm-search-filter')?.value || "").toLowerCase().trim();

    const filteredCustomers = appData.customers.filter(c => {
        return (c.name && c.name.toLowerCase().includes(searchTerm)) || 
               (c.phone && c.phone.toLowerCase().includes(searchTerm)) || 
               (c.city && c.city.toLowerCase().includes(searchTerm)) ||
               (c.category && c.category.toLowerCase().includes(searchTerm));
    });

    if (filteredCustomers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-secondary); padding: 32px;">No matching customer profiles found.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredCustomers.map((c) => {
        const index = appData.customers.indexOf(c);
        
        let badgeClass = 'consumer';
        if (c.category === 'Retail Supermarket / Store') badgeClass = 'store';
        else if (c.category === 'Wholesale Distributor') badgeClass = 'wholesale';
        else if (c.category === 'Corporate / Event Buyer') badgeClass = 'corporate';

        const categoryBadge = `<span class="status-badge ${badgeClass}">${c.category || 'Direct Retail Consumer'}</span>`;

        return `
            <tr>
                <td data-label="Customer Name"><strong>${c.name}</strong></td>
                <td data-label="Category">${categoryBadge}</td>
                <td data-label="Contact & Location">${c.phone || '-'}<br><small style="color: var(--text-secondary);">${c.city || '-'}</small></td>
                <td data-label="Total Orders">${c.ordersCount || 0}</td>
                <td data-label="Lifetime Revenue"><strong class="customer-revenue-cell">₹${c.lifetimeRevenue || 0}</strong></td>
                <td data-label="Last Order Date">${c.lastOrderDate || 'N/A'}</td>
                <td data-label="Action">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn-outline" onclick="editCustomerItem(${index})">Edit</button>
                        <button class="btn-danger" onclick="deleteCustomer(${index})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// Clear Customer Search Filter
window.clearCRMFilter = function() {
    const searchInput = document.getElementById('crm-search-filter');
    if (searchInput) searchInput.value = '';
    renderCustomers();
};

// Add or Update Customer Form Submission
window.saveCustomer = async function(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('cust-name').value.trim();
    const category = document.getElementById('cust-type').value;
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const city = document.getElementById('cust-city').value.trim();
    const creditLimit = Number(document.getElementById('cust-credit-limit').value) || 0;

    if (editingIndex === null) {
        if (appData.customers.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            await customAlert("Duplicate Customer", "A customer profile with this name already exists.");
            return;
        }
    }

    const customerObj = {
        name,
        category,
        phone,
        email,
        city,
        creditLimit,
        ordersCount: editingIndex !== null ? appData.customers[editingIndex].ordersCount : 0,
        lifetimeRevenue: editingIndex !== null ? appData.customers[editingIndex].lifetimeRevenue : 0,
        lastOrderDate: editingIndex !== null ? appData.customers[editingIndex].lastOrderDate : 'N/A'
    };

    if (editingIndex !== null) {
        const target = appData.customers[editingIndex];
        customerObj.firebaseId = target.firebaseId;
        appData.customers[editingIndex] = customerObj;

        if (customerObj.firebaseId) {
            await updateDataDoc('customers', customerObj.firebaseId, customerObj);
        }
        cancelCustomerEdit();
    } else {
        await saveDataDoc('customers', customerObj);
        appData.customers.push(customerObj);
        document.getElementById('crm-form').reset();
    }

    renderCustomers();
};

// Edit Customer Profile
window.editCustomerItem = function(index) {
    const customer = appData.customers[index];
    if (!customer) return;

    editingIndex = index;
    document.getElementById('customer-edit-index').value = index;
    document.getElementById('cust-name').value = customer.name;
    document.getElementById('cust-type').value = customer.category || 'Direct Retail Consumer';
    document.getElementById('cust-phone').value = customer.phone || '';
    document.getElementById('cust-email').value = customer.email || '';
    document.getElementById('cust-city').value = customer.city || '';
    document.getElementById('cust-credit-limit').value = customer.creditLimit || 0;

    document.getElementById('crm-form-title').innerText = `Edit Customer Profile: ${customer.name}`;
    document.getElementById('cust-submit-btn').innerText = 'Update Profile';
    document.getElementById('cust-cancel-btn').style.display = 'inline-flex';

    document.getElementById('crm-form').scrollIntoView({ behavior: 'smooth' });
};

// Cancel Editing
window.cancelCustomerEdit = function() {
    editingIndex = null;
    document.getElementById('customer-edit-index').value = '';
    document.getElementById('crm-form').reset();
    document.getElementById('crm-form-title').innerText = 'Add New Customer / Retail Outlet';
    document.getElementById('cust-submit-btn').innerText = 'Save Customer Profile';
    document.getElementById('cust-cancel-btn').style.display = 'none';
};

// Delete Customer Item with Glassmorphic Custom Modal Prompt
window.deleteCustomer = async function(index) {
    const customer = appData.customers[index];
    if (!customer) return;

    const confirmed = await customConfirm(
        "Delete Customer?", 
        `Are you sure you want to delete this customer profile for "${customer.name}"?`
    );
    if (!confirmed) return;

    if (customer.firebaseId) {
        try {
            await deleteDataDoc('customers', customer.firebaseId);
        } catch (err) {
            console.error("Error deleting customer from cloud:", err);
        }
    }

    appData.customers.splice(index, 1);
    renderCustomers();
};

window.exportCSV = function(type) {
    exportCSVData(type);
};

window.exportJSON = function() {
    exportJSONData();
};

// Page Load Lifecycle
document.addEventListener('DOMContentLoaded', async () => {
    const dateDisplay = document.getElementById('current-date');
    if (dateDisplay) {
        dateDisplay.innerText = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    await loadCloudCollection('customers');
    renderCustomers();
    initSearchableSelects();
});