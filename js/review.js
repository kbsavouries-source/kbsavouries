// ==========================================================================
// Customer Review Module Logic (Firestore Cloud Storage)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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

const RATING_LABELS = ["Tap a star to rate", "Poor", "Fair", "Good", "Very good", "Excellent"];

// ---------- Star rating widget ----------
const ratingInput = document.getElementById("review-rating");
const starGroup = document.getElementById("kb-star-rating");
const starLabel = document.getElementById("kb-star-label");
const stars = starGroup ? Array.from(starGroup.querySelectorAll(".kb-star")) : [];

function paintStars(value) {
    stars.forEach((star) => {
        star.classList.toggle("filled", Number(star.dataset.value) <= value);
    });
}

function setRating(value) {
    ratingInput.value = String(value);
    paintStars(value);
    stars.forEach((star) => star.setAttribute("aria-checked", String(Number(star.dataset.value) === value)));
    starLabel.textContent = `${RATING_LABELS[value]}${value ? ` (${value}/5)` : ""}`;
}

stars.forEach((star) => {
    const value = Number(star.dataset.value);
    star.addEventListener("click", () => setRating(value));
    star.addEventListener("mouseenter", () => paintStars(value));      // hover preview
    star.addEventListener("focus", () => paintStars(value));
});
if (starGroup) {
    const restore = () => paintStars(Number(ratingInput.value));
    starGroup.addEventListener("mouseleave", restore);
    starGroup.addEventListener("focusout", restore);
}
setRating(0);

// ---------- Submit ----------
const form = document.getElementById("review-form");
const submitBtn = document.getElementById("review-submit");

async function submitCustomerReview(e) {
    e.preventDefault();

    const name = document.getElementById("review-name").value.trim();
    const checkedProds = Array.from(document.querySelectorAll(".review-prod-check:checked")).map((cb) => cb.value);
    const rating = Number(ratingInput.value);
    const comment = document.getElementById("review-comment").value.trim();

    if (checkedProds.length === 0) {
        alert("Please select at least one product you tried!");
        return;
    }
    if (!(rating >= 1 && rating <= 5)) {
        alert("Please tap a star to rate your experience.");
        return;
    }

    const now = new Date();
    const newReview = {
        name,
        product: checkedProds.join(", "),
        rating,
        comment,
        date: now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        createdAt: now.toISOString()
    };

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "SAVING…";

    try {
        // The success message is shown only after Firestore confirms the write.
        await addDoc(collection(db, "reviews"), newReview);
        form.reset();
        setRating(0);
        const successModal = document.getElementById("review-success-modal");
        if (successModal) {
            successModal.style.display = "flex";
        } else {
            window.location.href = "../index.html#reviews";
        }
    } catch (err) {
        console.error("Error saving review to Firestore:", err);
        alert("Failed to submit review. Please check your network connection.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
    }
}

form.addEventListener("submit", submitCustomerReview);