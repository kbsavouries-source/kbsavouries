// ==========================================================================
// KB Savouries - Order Management Module Logic
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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

window.appData = window.appData || {};
window.appData.orders = [];

export async function initOrderMgmt() {
    const todayStr = new Date().toISOString().split('T')[0];
    const orderDateEl = document.getElementById('order-date');
    if (orderDateEl) orderDateEl.value = todayStr;

    try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        window.appData.orders = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                firebaseId: docSnap.id,
                id: docSnap.id,
                ...data
            };
        });
    } catch (err) {
        console.error("Error loading orders from cloud:", err);
    }

    renderOrders();
}

export function calculateTotalAmount() {
    const qty = Number(document.getElementById('order-qty').value) || 0;
    const unitCost = Number(document.getElementById('unit-cost').value) || 0;
    const totalEl = document.getElementById('total-amount');
    if (totalEl) {
        totalEl.value = (qty * unitCost).toFixed(2);
    }
}

export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

export async function addOrder(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const editIndexEl = document.getElementById('order-edit-index');
    const editIndex = editIndexEl ? editIndexEl.value : '';
    
    const qtyVal = Number(document.getElementById('order-qty').value) || 0;
    const unitCostVal = Number(document.getElementById('unit-cost').value) || 0;
    const totalVal = qtyVal * unitCostVal;

    if (editIndex !== '') {
        const index = Number(editIndex);
        const order = window.appData.orders[index];
        if (!order) return;

        order.orderDate = document.getElementById('order-date').value;
        order.customerName = document.getElementById('customer-name').value.trim();
        order.customerPhone = document.getElementById('customer-phone').value.trim();
        order.deliveryAddress = document.getElementById('delivery-address').value.trim();
        order.productName = document.getElementById('order-product').value.trim();
        order.qty = qtyVal;
        order.unitCost = unitCostVal;
        order.totalAmount = totalVal;
        order.requiredDate = document.getElementById('required-date').value;
        order.requiredTime = document.getElementById('required-time').value.trim();

        renderOrders();
        resetOrderForm();

        const docId = order.firebaseId || order.id;
        if (docId) {
            try {
                await updateDoc(doc(db, 'orders', docId), {
                    orderDate: order.orderDate,
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    deliveryAddress: order.deliveryAddress,
                    productName: order.productName,
                    qty: order.qty,
                    unitCost: order.unitCost,
                    totalAmount: order.totalAmount,
                    requiredDate: order.requiredDate,
                    requiredTime: order.requiredTime
                });
            } catch (err) {
                console.error("Error updating order in cloud:", err);
            }
        }
    } else {
        const newOrder = {
            orderDate: document.getElementById('order-date').value,
            customerName: document.getElementById('customer-name').value.trim(),
            customerPhone: document.getElementById('customer-phone').value.trim(),
            deliveryAddress: document.getElementById('delivery-address').value.trim(),
            productName: document.getElementById('order-product').value.trim(),
            qty: qtyVal,
            unitCost: unitCostVal,
            totalAmount: totalVal,
            requiredDate: document.getElementById('required-date').value,
            requiredTime: document.getElementById('required-time').value.trim(),
            status: "Pending"
        };

        window.appData.orders.unshift(newOrder);
        renderOrders();
        resetOrderForm();

        try {
            const docRef = await addDoc(collection(db, 'orders'), newOrder);
            newOrder.firebaseId = docRef.id;
            newOrder.id = docRef.id;
        } catch (err) {
            console.error("Error saving new order to Firestore:", err);
            alert("Warning: Could not save order to database.");
        }
    }
}

export function editOrder(index) {
    const order = window.appData.orders[index];
    if (!order) return;

    document.getElementById('order-edit-index').value = index;
    document.getElementById('order-date').value = order.orderDate || '';
    document.getElementById('customer-name').value = order.customerName || '';
    document.getElementById('customer-phone').value = order.customerPhone || '';
    document.getElementById('delivery-address').value = order.deliveryAddress || '';
    document.getElementById('order-product').value = order.productName || '';
    document.getElementById('order-qty').value = order.qty || 1;
    document.getElementById('unit-cost').value = order.unitCost || 0;
    document.getElementById('required-date').value = order.requiredDate || '';
    document.getElementById('required-time').value = order.requiredTime || '';
    
    calculateTotalAmount();

    document.getElementById('order-form-title').innerText = "Edit Customer Order";
    document.getElementById('order-submit-btn').innerText = "Update Order";
    document.getElementById('order-cancel-btn').style.display = "inline-block";

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function cancelOrderEdit() {
    resetOrderForm();
}

function resetOrderForm() {
    const todayStr = new Date().toISOString().split('T')[0];
    document.getElementById('order-form').reset();
    document.getElementById('order-edit-index').value = '';
    document.getElementById('order-date').value = todayStr;
    document.getElementById('order-form-title').innerText = "Create New Customer Order";
    document.getElementById('order-submit-btn').innerText = "Save Order";
    document.getElementById('order-cancel-btn').style.display = "none";
    calculateTotalAmount();
}

export async function toggleOrderStatus(index) {
    const order = window.appData.orders[index];
    if (!order) return;

    const newStatus = order.status === "Pending" ? "Completed" : "Pending";
    order.status = newStatus;
    
    renderOrders();

    const docId = order.firebaseId || order.id;
    if (docId) {
        try {
            await updateDoc(doc(db, 'orders', docId), {
                status: newStatus
            });
        } catch (err) {
            console.error("Error updating order status in cloud:", err);
        }
    }
}

export async function deleteOrder(index) {
    const orderToDelete = window.appData.orders[index];
    if (!orderToDelete) return;

    window.appData.orders.splice(index, 1);
    renderOrders();

    const docId = orderToDelete.firebaseId || orderToDelete.id;
    if (docId) {
        try {
            await deleteDoc(doc(db, 'orders', docId));
        } catch (err) {
            console.error("Error deleting order from Firestore:", err);
        }
    }
}

export function exportOrdersCSV() {
    if (!window.appData.orders || window.appData.orders.length === 0) {
        alert("No orders available to export.");
        return;
    }

    const headers = ["Order Date", "Customer Name", "Mobile No", "Delivery Address", "Product", "Qty", "Unit Cost", "Total Amount", "Required Date", "Required Time", "Status"];
    const csvRows = [headers.join(",")];

    window.appData.orders.forEach(o => {
        const addressEscaped = `"${(o.deliveryAddress || '').replace(/"/g, '""')}"`;
        const customerEscaped = `"${(o.customerName || '').replace(/"/g, '""')}"`;
        const productEscaped = `"${(o.productName || '').replace(/"/g, '""')}"`;

        const row = [
            o.orderDate || '',
            customerEscaped,
            o.customerPhone || '',
            addressEscaped,
            productEscaped,
            o.qty || 0,
            o.unitCost || 0,
            o.totalAmount || 0,
            o.requiredDate || '',
            o.requiredTime || '',
            o.status || 'Pending'
        ];
        csvRows.push(row.join(","));
    });

    const csvBlob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `KB_Savouries_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export function renderOrders() {
    const tbody = document.getElementById('order-table-body');
    const filterVal = document.getElementById('status-filter')?.value || 'ALL';
    if (!tbody || !window.appData.orders) return;

    let filtered = window.appData.orders;
    if (filterVal !== 'ALL') {
        filtered = filtered.filter(o => o.status === filterVal);
    }

    tbody.innerHTML = filtered.map((o) => {
        const realIndex = window.appData.orders.indexOf(o);
        const isPending = o.status === 'Pending';
        
        return `
            <tr>
                <td data-label="Order Date">${formatDate(o.orderDate)}</td>
                <td data-label="Customer"><strong>${o.customerName}</strong></td>
                <td data-label="Mobile">${o.customerPhone}</td>
                <td data-label="Address" class="cell-address">${o.deliveryAddress}</td>
                <td data-label="Product">${o.productName}</td>
                <td data-label="Qty">${o.qty}</td>
                <td data-label="Unit Cost">₹${o.unitCost}</td>
                <td data-label="Total"><strong>₹${o.totalAmount}</strong></td>
                <td data-label="Required Date & Time">
                    <span class="required-deadline">
                        ${formatDate(o.requiredDate)} @ ${o.requiredTime}
                    </span>
                </td>
                <td data-label="Status">
                    <span class="status-badge ${isPending ? 'status-pending' : 'status-completed'}">
                        ${o.status}
                    </span>
                </td>
                <td data-label="Action">
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn-toggle-status ${isPending ? 'btn-mark-completed' : 'btn-mark-pending'}" 
                                onclick="toggleOrderStatus(${realIndex})">
                            ${isPending ? 'Mark Completed' : 'Mark Pending'}
                        </button>
                        <button class="btn-outline" style="padding: 6px 10px; font-size: 0.78rem;" onclick="editOrder(${realIndex})">Edit</button>
                        <button class="btn-danger" style="padding: 6px 10px; font-size: 0.78rem;" onclick="deleteOrder(${realIndex})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.addOrder = addOrder;
window.editOrder = editOrder;
window.cancelOrderEdit = cancelOrderEdit;
window.toggleOrderStatus = toggleOrderStatus;
window.deleteOrder = deleteOrder;
window.exportOrdersCSV = exportOrdersCSV;
window.calculateTotalAmount = calculateTotalAmount;
window.renderOrders = renderOrders;

document.addEventListener('DOMContentLoaded', () => {
    initOrderMgmt();
});