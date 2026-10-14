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
    boms: []
};

// Default Master Seed Data
export const defaultSKUs = [
    { name: "Poha Crunch - 30g", type: "Finished Inventory", grams: 30, price: 15, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 50g", type: "Finished Inventory", grams: 50, price: 25, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 250g", type: "Finished Inventory", grams: 250, price: 110, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 500g", type: "Finished Inventory", grams: 500, price: 210, measure: "Pkts", unit: "Pkts" },
    { name: "Poha Crunch - 1 Kg", type: "Finished Inventory", grams: 1000, price: 400, measure: "Pkts", unit: "Pkts" },
    { name: "Poha", type: "Raw Material", grams: 0, price: 0, unit: "Kg" },
    { name: "Peanut", type: "Raw Material", grams: 0, price: 0, unit: "Kg" },
    { name: "Roasted Channa", type: "Raw Material", grams: 0, price: 0, unit: "Kg" },
    { name: "Rice Bran Oil", type: "Raw Material", grams: 0, price: 0, unit: "Ltrs" },
    { name: "Curry Leaves", type: "Raw Material", grams: 0, price: 0, unit: "Gms" },
    { name: "Turmeric", type: "Raw Material", grams: 0, price: 0, unit: "Gms" },
    { name: "Chilli Powder", type: "Raw Material", grams: 0, price: 0, unit: "Gms" },
    { name: "Salt", type: "Raw Material", grams: 0, price: 0, unit: "Kg" }
];

// Helper to Load Collections from Cloud Firestore
export async function loadCloudCollection(colName, fallbackSeed = []) {
    try {
        const querySnapshot = await getDocs(collection(db, colName));
        appData[colName] = querySnapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));

        if (appData[colName].length === 0 && fallbackSeed.length > 0) {
            for (let item of fallbackSeed) {
                const docRef = await addDoc(collection(db, colName), item);
                item.firebaseId = docRef.id;
                appData[colName].push(item);
            }
        }
    } catch (err) {
        console.error(`Error loading cloud collection ${colName}:`, err);
        appData[colName] = fallbackSeed;
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
        alert("No data available to export in " + type);
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