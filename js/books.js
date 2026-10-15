// Import Firebase SDKs
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
    sales: [],
    batches: [],
    purchases: [],
    samples: [],
    inventory: [],
    customers: []
};

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

async function loadCloudData() {
    try {
        const collections = ['sales', 'batches', 'skus', 'purchases', 'samples', 'inventory', 'customers'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        }
    } catch (err) {
        console.error("Error loading cloud data for dashboard:", err);
    }

    updateDashboard();
}

function updateDashboard() {
    let totalRev = window.appData.sales.reduce((sum, item) => sum + Number(item.total), 0);
    const revEl = document.getElementById('stat-revenue');
    const ordersEl = document.getElementById('stat-orders');
    const batchesEl = document.getElementById('stat-batches');

    if (revEl) revEl.innerText = `₹${totalRev}`;
    if (ordersEl) ordersEl.innerText = window.appData.sales.length;
    
    let activeBatches = window.appData.batches.filter(b => Number(b.remainingGrams) > 0).length;
    if (batchesEl) batchesEl.innerText = activeBatches;

    // Calculate separated SKU category counts
    const allSkus = [...window.appData.skus, ...window.appData.inventory];
    const finishedCount = allSkus.filter(item => (item.category || item.type || '').toLowerCase().includes('finished')).length;
    const rawCount = allSkus.filter(item => (item.category || item.type || '').toLowerCase().includes('raw')).length;

    const finishedEl = document.getElementById('dash-finished-skus');
    const rawEl = document.getElementById('dash-raw-skus');
    const custsEl = document.getElementById('dash-total-customers');

    if (finishedEl) finishedEl.innerText = finishedCount;
    if (rawEl) rawEl.innerText = rawCount;
    if (custsEl) custsEl.innerText = window.appData.customers.length;
}

export function exportJSON() {
    const todayStr = new Date().toISOString().split('T')[0];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.appData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `kb_savouries_backup_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

// Window bindings for inline events
window.exportJSON = exportJSON;
window.toggleSidebar = toggleSidebar;

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('kb_authenticated') === 'true') {
        const modal = document.getElementById('passcode-modal');
        if (modal) modal.style.display = 'none';
    }

    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    loadCloudData();
});