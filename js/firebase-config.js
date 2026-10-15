import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCullX49Und6AmRgg8UL9hP1cLvQ-KVnEI",
    authDomain: "kb-savouries.firebaseapp.com",
    projectId: "kb-savouries",
    storageBucket: "kb-savouries.firebasestorage.app",
    messagingSenderId: "805966330754",
    appId: "1:805966330754:web:22cf30e2499298e4456d9b"
};

const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// Shared Global App State Object
export let appData = {
    skus: [],
    sales: [],
    batches: [],
    purchases: [],
    samples: [],
    boms: [],
    customers: []
};

// Default Master Seed Data (Empty to prevent auto-recreation on full deletion)
export const defaultSKUs = [];

// Helper to Load Collections from Cloud Firestore
export async function loadCloudCollection(colName) {
    try {
        const querySnapshot = await getDocs(collection(db, colName));
        appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
    } catch (err) {
        console.error(`Error loading cloud collection ${colName}:`, err);
        appData[colName] = [];
    }
}

// Helper to Save a New Document to Firestore
export async function saveDataDoc(collectionName, dataObj) {
    try {
        const docRef = await addDoc(collection(db, collectionName), dataObj);
        dataObj.firebaseId = docRef.id;
    } catch (e) {
        console.error(`Error writing to Firestore (${collectionName}):`, e);
    }
}

// Helper to Update an Existing Document in Firestore
export async function updateDataDoc(collectionName, firebaseId, updatePayload) {
    try {
        if (firebaseId) {
            await updateDoc(doc(db, collectionName, firebaseId), updatePayload);
        }
    } catch (e) {
        console.error(`Error updating Firestore (${collectionName}):`, e);
    }
}

// Helper to Delete a Document from Firestore
export async function deleteDataDoc(collectionName, firebaseId) {
    try {
        if (firebaseId) {
            await deleteDoc(doc(db, collectionName, firebaseId));
        }
    } catch (e) {
        console.error(`Error deleting from Firestore (${collectionName}):`, e);
    }
}

// Global Export JSON Backup Utility
export function exportJSONData() {
    const todayStr = new Date().toISOString().split('T')[0];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `kb_savouries_backup_${todayStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// Global Export CSV Utility
export function exportCSVData(type) {
    const todayStr = new Date().toISOString().split('T')[0];
    let items = appData[type];
    if (!items || items.length === 0) {
        customAlert("Export Notice", "No data available to export in " + type);
        return;
    }
    let keys = Object.keys(items[0]);
    let csvContent = "data:text/csv;charset=utf-8," + keys.join(",") + "\n";
    items.forEach(row => {
        let val = keys.map(k => `"${row[k]}"`).join(",");
        csvContent += val + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const linkAnchor = document.createElement("a");
    linkAnchor.setAttribute("href", encodedUri);
    linkAnchor.setAttribute("download", `kb_savouries_${type}_${todayStr}.csv`);
    document.body.appendChild(linkAnchor);
    linkAnchor.click();
    linkAnchor.remove();
}

// ==========================================================================
// Custom Glassmorphic Modal Utilities (Replaces browser alert/confirm popups)
// ==========================================================================

export function customConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML = `
            <div class="custom-modal-card">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="custom-modal-actions">
                    <button class="btn-outline" id="modal-cancel-btn">Cancel</button>
                    <button class="btn-danger" id="modal-confirm-btn">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('#modal-cancel-btn');
        const confirmBtn = overlay.querySelector('#modal-confirm-btn');

        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(false);
        };
        confirmBtn.onclick = () => {
            overlay.remove();
            resolve(true);
        };
    });
}

export function customAlert(title, message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        overlay.innerHTML = `
            <div class="custom-modal-card">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="custom-modal-actions">
                    <button class="btn-primary" id="modal-ok-btn">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const okBtn = overlay.querySelector('#modal-ok-btn');
        okBtn.onclick = () => {
            overlay.remove();
            resolve(true);
        };
    });
}