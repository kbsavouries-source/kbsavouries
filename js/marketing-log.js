// ==========================================================================
// Samples & Marketing Module Logic
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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
    samples: []
};

// Produced quantity of a batch (the ceiling remaining stock can never exceed)
function getBatchCapacity(batch) {
    return Number(batch.totalGrams || batch.weightGrams || batch.outputGrams) || 0;
}

// Self-heal: any batch showing more stock than was produced is clamped back
// to its produced quantity (and saved), fixing earlier over-restores.
async function reconcileOverfilledBatches() {
    const overfilled = window.appData.batches.filter(b => {
        const cap = getBatchCapacity(b);
        return cap > 0 && Number(b.remainingGrams) > cap;
    });
    if (overfilled.length === 0) return;

    const wb = writeBatch(db);
    let hasWrites = false;
    for (const b of overfilled) {
        b.remainingGrams = getBatchCapacity(b);
        b.status = 'Available';
        if (b.firebaseId) {
            wb.update(doc(db, 'batches', b.firebaseId), { remainingGrams: b.remainingGrams, status: b.status });
            hasWrites = true;
        }
    }
    if (hasWrites) {
        try {
            await wb.commit();
            console.info(`Corrected ${overfilled.length} batch(es) that exceeded produced quantity.`);
        } catch (err) {
            console.error("Error correcting over-filled batches:", err);
        }
    }
}

export async function initMarketingLog() {
    const todayStr = new Date().toISOString().split('T')[0];
    const sampleDateEl = document.getElementById('sample-date');
    if (sampleDateEl) sampleDateEl.value = todayStr;

    try {
        const collections = ['batches', 'samples'];
        for (const colName of collections) {
            const querySnapshot = await getDocs(collection(db, colName));
            window.appData[colName] = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    firebaseId: doc.id,
                    id: doc.id, // backup reference
                    ...data
                };
            });
        }
    } catch (err) {
        console.error("Error loading cloud data for samples:", err);
    }

    if (!window.appData.samples) window.appData.samples = [];

    await reconcileOverfilledBatches();

    populateSampleBatchOptions();
    renderSamples();
}

export function formatGrams(grams) {
    const g = Number(grams) || 0;
    if (Math.abs(g) >= 1000) {
        return `${(g / 1000).toFixed(2)} Kg`;
    }
    return `${g.toFixed(g % 1 === 0 ? 0 : 1)} gms`;
}

export function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

export function populateSampleBatchOptions() {
    const batchSelect = document.getElementById('sample-batch');
    const submitBtn = document.getElementById('sample-submit-btn');
    if (!batchSelect || !window.appData) return;

    const matchingBatches = window.appData.batches.filter(b => Number(b.remainingGrams) > 0);

    if (matchingBatches.length === 0) {
        batchSelect.innerHTML = `<option value="">No Stock</option>`;
        if (submitBtn) submitBtn.disabled = true;
    } else {
        batchSelect.innerHTML = matchingBatches.map(b => 
            `<option value="${b.code}">${b.code} (${formatGrams(b.remainingGrams)} left)</option>`
        ).join('');
        if (submitBtn) submitBtn.disabled = false;
    }
}

export async function addSample(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const qtyVal = Number(document.getElementById('sample-qty').value);
    const unitVal = document.getElementById('sample-unit').value;
    const selectedBatchCode = document.getElementById('sample-batch').value;

    if (!selectedBatchCode) {
        alert("Cannot log sample. No stock available.");
        return;
    }

    const totalGramsGiven = unitVal === 'Kg' ? qtyVal * 1000 : qtyVal;

    const batch = window.appData.batches.find(b => b.code === selectedBatchCode);
    if (batch) {
        if (Number(batch.remainingGrams) < totalGramsGiven) {
            alert(`Cannot log sample. Selected batch only has ${formatGrams(batch.remainingGrams)} remaining, but this requires ${formatGrams(totalGramsGiven)}.`);
            return;
        }
        batch.remainingGrams = Number(batch.remainingGrams) - totalGramsGiven;
        if (batch.remainingGrams <= 0) {
            batch.remainingGrams = 0;
            batch.status = 'Sold Out';
        }

        // Update batch remaining grams in Firestore
        if (batch.firebaseId) {
            try {
                await updateDoc(doc(db, 'batches', batch.firebaseId), {
                    remainingGrams: batch.remainingGrams,
                    status: batch.status
                });
            } catch (err) {
                console.error("Error updating batch remaining stock:", err);
            }
        }
    }

    const sample = {
        date: document.getElementById('sample-date').value,
        recipient: document.getElementById('sample-recipient').value,
        batchCode: selectedBatchCode,
        qty: qtyVal,
        unit: unitVal,
        gramsGiven: totalGramsGiven,
        purpose: document.getElementById('sample-purpose').value
    };

    window.appData.samples.push(sample);
    try {
        const docRef = await addDoc(collection(db, 'samples'), sample);
        // Keep the Firestore id so this sample can be deleted from the cloud later
        sample.firebaseId = docRef.id;
        sample.id = docRef.id;
    } catch (err) {
        console.error("Error saving sample:", err);
    }

    renderSamples();
    populateSampleBatchOptions();
    document.getElementById('sample-form').reset();
    document.getElementById('sample-date').value = todayStr;
}

export function renderSamples() {
    const tbody = document.getElementById('sample-table-body');
    if(!tbody || !window.appData) return;

    let totalGramsGiven = window.appData.samples.reduce((sum, s) => sum + Number(s.gramsGiven || 0), 0);
    const totalWeightBox = document.getElementById('sample-total-weight');
    if (totalWeightBox) totalWeightBox.innerText = formatGrams(totalGramsGiven);

    tbody.innerHTML = window.appData.samples.map((s) => {
        const qtyDisplay = `${s.qty} ${s.unit || 'Gms'} (${formatGrams(s.gramsGiven)})`;
        const realIndex = window.appData.samples.indexOf(s);
        return `
            <tr>
                <td data-label="Date">${formatDate(s.date)}</td>
                <td data-label="Shoot / Event / Recipient">${s.recipient}</td>
                <td data-label="Batch Code"><code>${s.batchCode || 'N/A'}</code></td>
                <td data-label="Quantity Given">${qtyDisplay}</td>
                <td data-label="Purpose">${s.purpose}</td>
                <td data-label="Action"><button class="btn-danger" onclick="deleteSampleItem(${realIndex})">Delete</button></td>
            </tr>
        `;
    }).join('');
}

const pendingSampleDeletes = new Set(); // blocks rapid repeat clicks on the same sample

export async function deleteSampleItem(index) {
    if (!window.appData) return;
    const sample = window.appData.samples[index];
    if (!sample) return;

    if (pendingSampleDeletes.has(sample)) return;
    pendingSampleDeletes.add(sample);

    // 1. Work out the restored stock, capped at the produced quantity
    let batch = null;
    let rollback = null;
    let batchUpdate = null;

    if (sample.batchCode && sample.batchCode !== 'N/A') {
        batch = window.appData.batches.find(b => b.code === sample.batchCode) || null;
    }

    if (batch) {
        const restoredGrams = Number(sample.gramsGiven) || 0;
        const currentRemaining = Number(batch.remainingGrams) || 0;
        const capacity = getBatchCapacity(batch);

        let newRemaining = currentRemaining + restoredGrams;
        if (capacity > 0 && newRemaining > capacity) {
            newRemaining = capacity; // never show more than was produced
        }
        const newStatus = newRemaining > 0 ? 'Available' : 'Sold Out';

        rollback = { remainingGrams: batch.remainingGrams, status: batch.status };
        batch.remainingGrams = newRemaining;
        batch.status = newStatus;

        if (batch.firebaseId) {
            batchUpdate = { firebaseId: batch.firebaseId, data: { remainingGrams: newRemaining, status: newStatus } };
        }
    }

    // 2. Optimistic local update (instant UI)
    window.appData.samples.splice(index, 1);
    renderSamples();
    populateSampleBatchOptions();

    // 3. One atomic Firestore commit: stock restore + sample delete
    try {
        if (batchUpdate || sample.firebaseId) {
            const wb = writeBatch(db);
            if (batchUpdate) {
                wb.update(doc(db, 'batches', batchUpdate.firebaseId), batchUpdate.data);
            }
            if (sample.firebaseId) {
                wb.delete(doc(db, 'samples', sample.firebaseId));
            }
            await wb.commit();
        }
    } catch (err) {
        console.error("Error deleting sample / restoring stock:", err);

        // 4. Roll back local state so the UI matches the database
        if (batch && rollback) {
            batch.remainingGrams = rollback.remainingGrams;
            batch.status = rollback.status;
        }
        if (!window.appData.samples.includes(sample)) {
            window.appData.samples.splice(Math.min(index, window.appData.samples.length), 0, sample);
        }
        renderSamples();
        populateSampleBatchOptions();
        alert("Could not delete the sample. Your data has been restored. Please check your connection and try again.");
    } finally {
        pendingSampleDeletes.delete(sample);
    }
}

// Bind functions to window scope for inline HTML event handling
window.addSample = addSample;
window.deleteSampleItem = deleteSampleItem;

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initMarketingLog();
});