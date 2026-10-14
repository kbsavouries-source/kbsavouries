import { 
    db, 
    appData, 
    loadCloudCollection, 
    saveDataDoc, 
    updateDataDoc, 
    deleteDataDoc, 
    exportCSVData, 
    exportJSONData 
} from './firebase-config.js';

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

function formatDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Calculate Lifetime Sales Analytics for a specific customer from Sales Register records
function getCustomerSalesSummary(customerName) {
    if (!appData.sales || !customerName) return { orderCount: 0, totalRevenue: 0, lastOrderDate: 'N/A' };

    const matchingSales = appData.sales.filter(s => s.customer && s.customer.toLowerCase().trim() === customerName.toLowerCase().trim());
    
    if (matchingSales.length === 0) return { orderCount: 0, totalRevenue: 0, lastOrderDate: 'N/A' };

    const totalRevenue = matchingSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    
    // Sort by date to find the most recent order
    const sortedSales = [...matchingSales].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastOrderDate = sortedSales[0].date;

    return {
        orderCount: matchingSales.length,
        totalRevenue: totalRevenue,
        lastOrderDate: lastOrderDate
    };
}

// Render CRM Directory Table
window.renderCustomers = function() {
    const tbody = document.getElementById('crm-table-body');
    if (!tbody) return;

    if (!appData.customers) appData.customers = [];

    const searchFilter = document.getElementById('crm-search-filter') ? document.getElementById('crm-search-filter').value.toLowerCase().trim() : '';

    let displayedCustomers = appData.customers;

    if (searchFilter) {
        displayedCustomers = displayedCustomers.filter(c => 
            (c.name && c.name.toLowerCase().includes(searchFilter)) ||
            (c.phone && c.phone.toLowerCase().includes(searchFilter)) ||
            (c.city && c.city.toLowerCase().includes(searchFilter))
        );
    }

    tbody.innerHTML = displayedCustomers.map((c) => {
        const index = appData.customers.indexOf(c);
        const stats = getCustomerSalesSummary(c.name);

        let badgeClass = 'consumer';
        if (c.type.includes('Store')) badgeClass = 'store';
        else if (c.type.includes('Wholesale')) badgeClass = 'wholesale';
        else if (c.type.includes('Corporate')) badgeClass = 'corporate';

        const contactInfo = [c.phone, c.email, c.city].filter(Boolean).join(' • ') || 'No contact details';

        return `
            <tr>
                <td data-label="Customer Name"><strong>${c.name}</strong></td>
                <td data-label="Category"><span class="status-badge ${badgeClass}">${c.type}</span></td>
                <td data-label="Contact & Location">${contactInfo}</td>
                <td data-label="Total Orders">${stats.orderCount}</td>
                <td data-label="Lifetime Revenue (₹)" class="customer-revenue-cell">₹${stats.totalRevenue.toLocaleString('en-IN')}</td>
                <td data-label="Last Order Date">${formatDate(stats.lastOrderDate)}</td>
                <td data-label="Action">
                    <button class="btn-outline" style="padding: 6px 12px; font-size: 0.8rem; min-height: 36px;" onclick="editCustomerItem(${index})">Edit</button>
                    <button class="btn-danger" onclick="deleteCustomerItem(${index})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
};

// Add or Update Customer Submission
window.addCustomer = async function(e) {
    e.preventDefault();
    const editIndex = document.getElementById('customer-edit-index').value;
    const name = document.getElementById('cust-name').value.trim();

    if (editIndex === "") {
        if (appData.customers.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            alert("A customer profile with this name already exists.");
            return;
        }
    }

    const customerObj = {
        name: name,
        type: document.getElementById('cust-type').value,
        phone: document.getElementById('cust-phone').value.trim(),
        email: document.getElementById('cust-email').value.trim(),
        city: document.getElementById('cust-city').value.trim(),
        creditLimit: Number(document.getElementById('cust-credit-limit').value) || 0
    };

    if (editIndex !== "") {
        const index = Number(editIndex);
        customerObj.firebaseId = appData.customers[index].firebaseId;
        appData.customers[index] = customerObj;

        if (customerObj.firebaseId) {
            await updateDataDoc('customers', customerObj.firebaseId, customerObj);
        }
        cancelCustomerEdit();
    } else {
        appData.customers.push(customerObj);
        await saveDataDoc('customers', customerObj);
        document.getElementById('crm-form').reset();
    }

    renderCustomers();
};

// Edit Customer
window.editCustomerItem = function(index) {
    const customer = appData.customers[index];
    if (!customer) return;

    document.getElementById('customer-edit-index').value = index;
    document.getElementById('cust-name').value = customer.name;
    document.getElementById('cust-type').value = customer.type;
    document.getElementById('cust-phone').value = customer.phone || '';
    document.getElementById('cust-email').value = customer.email || '';
    document.getElementById('cust-city').value = customer.city || '';
    document.getElementById('cust-credit-limit').value = customer.creditLimit || 0;

    document.getElementById('crm-form-title').innerText = `Edit Customer Profile: ${customer.name}`;
    document.getElementById('cust-submit-btn').innerText = 'Update Profile';
    document.getElementById('cust-cancel-btn').style.display = 'inline-flex';

    document.getElementById('crm-form').scrollIntoView({ behavior: 'smooth' });
};

// Cancel Customer Editing
window.cancelCustomerEdit = function() {
    document.getElementById('customer-edit-index').value = '';
    document.getElementById('crm-form').reset();
    document.getElementById('crm-form-title').innerText = 'Add New Customer / Retail Outlet';
    document.getElementById('cust-submit-btn').innerText = 'Save Customer Profile';
    document.getElementById('cust-cancel-btn').style.display = 'none';
};

// Delete Customer
window.deleteCustomerItem = async function(index) {
    if (!confirm("Are you sure you want to delete this customer profile?")) return;
    const customerToDelete = appData.customers[index];
    await deleteDataDoc('customers', customerToDelete.firebaseId);
    appData.customers.splice(index, 1);
    renderCustomers();
};

window.clearCRMFilter = function() {
    const searchInput = document.getElementById('crm-search-filter');
    if (searchInput) searchInput.value = '';
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

    await loadCloudCollection('customers', []);
    await loadCloudCollection('sales', []);
    renderCustomers();
    initSearchableSelects();
});