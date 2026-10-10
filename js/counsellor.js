/* =========================================================
   SMHOS SUPPORT
   COUNSELLOR DASHBOARD
   ========================================================= */

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    updateDoc,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { auth, db } from "./firebase.js";


// =========================================================
// ELEMENTS
// =========================================================

const requestsContainer =
    document.getElementById("counsellorRequestsContainer");

const counsellorNameElement =
    document.getElementById("counsellorName");

const welcomeNameElement =
    document.getElementById("welcomeCounsellorName");

const counsellorAvatar =
    document.getElementById("counsellorAvatar");

const pendingCountElement =
    document.getElementById("pendingRequestsCount");

const activeCountElement =
    document.getElementById("activeRequestsCount");

const appointmentsCountElement =
    document.getElementById("upcomingAppointmentsCount");

const sessionsCountElement =
    document.getElementById("completedSessionsCount");

const dateElement =
    document.getElementById("counsellorCurrentDate");

const logoutButton =
    document.getElementById("counsellorLogoutButton");

const menuToggle =
    document.getElementById("counsellorMenuToggle");

const sidebar =
    document.getElementById("counsellorSidebar");

const sidebarOverlay =
    document.getElementById("counsellorSidebarOverlay");


// =========================================================
// STATE
// =========================================================

let currentCounsellor = null;
let unsubscribeRequests = null;
let allCounsellorRequests = [];


// =========================================================
// INITIAL DISPLAY
// =========================================================

if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


// =========================================================
// SAFE HTML HELPERS
// =========================================================

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


function formatDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Just received";
    }

    return timestamp.toDate().toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


// =========================================================
// ERROR DISPLAY
// =========================================================

function showDashboardError(message) {
    if (!requestsContainer) return;

    requestsContainer.innerHTML = `
        <div class="counsellor-empty-state">
            <div class="empty-state-icon">!</div>
            <h3>Unable to load requests</h3>
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}


// =========================================================
// VERIFY COUNSELLOR AUTHORIZATION
// =========================================================

async function verifyCounsellor(user) {

    const profileRef = doc(db, "counsellors", user.uid);
    const profileSnapshot = await getDoc(profileRef);

    if (!profileSnapshot.exists()) {
        return null;
    }

    const profile = profileSnapshot.data();

    if (
        profile.role !== "counsellor" ||
        profile.approved !== true
    ) {
        return null;
    }

    return profile;
}


// =========================================================
// LOAD COUNSELLOR PROFILE
// =========================================================

function displayCounsellorProfile(profile, user) {

    const name =
        profile.name ||
        user.displayName ||
        user.email ||
        "Counsellor";

    if (counsellorNameElement) {
        counsellorNameElement.textContent = name;
    }

    if (welcomeNameElement) {
        welcomeNameElement.textContent = name;
    }

    if (counsellorAvatar) {
        counsellorAvatar.textContent =
            name.trim().charAt(0).toUpperCase() || "C";
    }
}


// =========================================================
// LOAD COUNSELLING REQUESTS
// =========================================================

function listenForCounsellorRequests() {

    if (unsubscribeRequests) {
        unsubscribeRequests();
        unsubscribeRequests = null;
    }

    if (!currentCounsellor) return;

    if (requestsContainer) {
        requestsContainer.innerHTML = `
            <div class="counsellor-loading-state">
                <div class="counsellor-loading-spinner"></div>
                <p>Loading support requests...</p>
            </div>
        `;
    }

    const requestsRef = collection(db, "counsellorRequests");

    // We listen to all pending requests and all requests assigned
    // to this counsellor. Firestore Rules must authorize these reads.
    const pendingQuery = query(
        requestsRef,
        where("status", "==", "pending")
    );

    unsubscribeRequests = onSnapshot(
        pendingQuery,
        snapshot => {

            const pendingRequests = snapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));

            // Only use this snapshot for incoming pending requests.
            renderIncomingRequests(pendingRequests);

            // Assigned requests are loaded separately below.
            listenForAssignedRequests();

        },
        error => {
            console.error(
                "PENDING COUNSELLING REQUESTS ERROR:",
                error
            );

            showDashboardError(
                "Check your Firestore permissions and connection."
            );
        }
    );
}


// =========================================================
// ASSIGNED REQUESTS
// =========================================================

let unsubscribeAssignedRequests = null;

function listenForAssignedRequests() {

    if (unsubscribeAssignedRequests) {
        unsubscribeAssignedRequests();
        unsubscribeAssignedRequests = null;
    }

    if (!currentCounsellor) return;

    const assignedQuery = query(
        collection(db, "counsellorRequests"),
        where("assignedCounsellorId", "==", currentCounsellor.uid)
    );

    unsubscribeAssignedRequests = onSnapshot(
        assignedQuery,
        snapshot => {

            const assignedRequests = snapshot.docs.map(item => ({
                id: item.id,
                ...item.data()
            }));

            allCounsellorRequests = assignedRequests;

            if (activeCountElement) {
                activeCountElement.textContent =
                    assignedRequests.filter(item =>
                        ["accepted", "in_progress"].includes(item.status)
                    ).length;
            }

            if (appointmentsCountElement) {
                appointmentsCountElement.textContent = "—";
            }

            if (sessionsCountElement) {
                sessionsCountElement.textContent = "—";
            }

        },
        error => {
            console.error(
                "ASSIGNED COUNSELLING REQUESTS ERROR:",
                error
            );
        }
    );
}


// =========================================================
// RENDER INCOMING REQUESTS
// =========================================================

function renderIncomingRequests(requests) {

    if (!requestsContainer) return;

    if (pendingCountElement) {
        pendingCountElement.textContent = requests.length;
    }

    if (requests.length === 0) {

        requestsContainer.innerHTML = `
            <div class="counsellor-empty-state">
                <div class="empty-state-icon">✓</div>
                <h3>No pending requests</h3>
                <p>
                    New student counselling requests will appear here.
                </p>
            </div>
        `;

        return;
    }

    const sortedRequests = [...requests].sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
    });

    requestsContainer.innerHTML = sortedRequests.map(request => {

        const anonymous = request.anonymous === true;

        // Do not expose student identifiers or names in this
        // interface when anonymous mode is enabled.
        const studentLabel = anonymous
            ? "Anonymous student"
            : "Student requesting support";

        const contactMethod = escapeHTML(
            request.contactPreference || "Not specified"
        );

        const message = request.message
            ? escapeHTML(request.message)
            : "The student did not include a message.";

        const requestDate = formatDate(request.createdAt);

        return `
            <article
                class="counsellor-request-card"
                data-request-id="${escapeHTML(request.id)}"
            >

                <div class="counsellor-request-card-top">

                    <div class="counsellor-request-avatar">
                        ${anonymous ? "A" : "S"}
                    </div>

                    <div class="counsellor-request-summary">
                        <h3>${studentLabel}</h3>
                        <p>${requestDate}</p>
                    </div>

                    <span class="counsellor-request-status">
                        Pending
                    </span>

                </div>

                <div class="counsellor-request-details">

                    <div class="counsellor-request-detail">
                        <span>Preferred contact</span>
                        <strong>${contactMethod}</strong>
                    </div>

                    <div class="counsellor-request-message">
                        <span>Message</span>
                        <p>${message}</p>
                    </div>

                </div>

                <div class="counsellor-request-actions">

                    <button
                        type="button"
                        class="counsellor-accept-button"
                        data-action="accept"
                        data-id="${escapeHTML(request.id)}"
                    >
                        Accept Request
                    </button>

                    <button
                        type="button"
                        class="counsellor-decline-button"
                        data-action="decline"
                        data-id="${escapeHTML(request.id)}"
                    >
                        Decline
                    </button>

                </div>

            </article>
        `;
    }).join("");
}


// =========================================================
// ACCEPT / DECLINE REQUEST
// =========================================================

if (requestsContainer) {

    requestsContainer.addEventListener("click", async event => {

        const button = event.target.closest("[data-action]");

        if (!button) return;

        if (!currentCounsellor) {
            alert("Your counsellor session is not available.");
            return;
        }

        const requestId = button.dataset.id;
        const action = button.dataset.action;

        if (!requestId) return;

        if (action === "decline") {

            const confirmed = confirm(
                "Are you sure you want to decline this request?"
            );

            if (!confirmed) return;
        }

        const card = button.closest(".counsellor-request-card");

        const actionButtons = card?.querySelectorAll("button");

        actionButtons?.forEach(item => {
            item.disabled = true;
        });

        try {

            const requestRef = doc(
                db,
                "counsellorRequests",
                requestId
            );

            // Re-read the request before updating it.
            const requestSnapshot = await getDoc(requestRef);

            if (!requestSnapshot.exists()) {
                throw new Error("This request no longer exists.");
            }

            const requestData = requestSnapshot.data();

            if (requestData.status !== "pending") {
                throw new Error(
                    "This request has already been handled."
                );
            }

            if (action === "accept") {

                await updateDoc(requestRef, {
                    status: "accepted",
                    assignedCounsellorId: currentCounsellor.uid,
                    acceptedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

            } else if (action === "decline") {

                await updateDoc(requestRef, {
                    status: "declined",
                    declinedByCounsellorId: currentCounsellor.uid,
                    declinedAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

            }

        } catch (error) {

            console.error(
                "COUNSELLING REQUEST ACTION ERROR:",
                error
            );

            alert(
                error.message ||
                "We couldn't update this request. Check your permissions."
            );

            actionButtons?.forEach(item => {
                item.disabled = false;
            });

        }

    });

}


// =========================================================
// SIGN OUT
// =========================================================

if (logoutButton) {

    logoutButton.addEventListener("click", async () => {

        const confirmed = confirm(
            "Are you sure you want to sign out?"
        );

        if (!confirmed) return;

        try {

            if (unsubscribeRequests) {
                unsubscribeRequests();
            }

            if (unsubscribeAssignedRequests) {
                unsubscribeAssignedRequests();
            }

            await signOut(auth);

            window.location.replace("../counsellor-login.html");

        } catch (error) {

            console.error("COUNSELLOR SIGN-OUT ERROR:", error);

            alert("Unable to sign out. Please try again.");

        }

    });

}


// =========================================================
// MOBILE NAVIGATION
// =========================================================

function closeMobileSidebar() {

    sidebar?.classList.remove("open");
    sidebarOverlay?.classList.remove("visible");

}

if (menuToggle) {

    menuToggle.addEventListener("click", () => {

        sidebar?.classList.toggle("open");
        sidebarOverlay?.classList.toggle("visible");

    });

}

if (sidebarOverlay) {

    sidebarOverlay.addEventListener(
        "click",
        closeMobileSidebar
    );

}


// =========================================================
// AUTHENTICATION GUARD
// =========================================================

onAuthStateChanged(auth, async user => {

    if (!user) {

        window.location.replace("../counsellor-login.html");
        return;

    }

    try {

        const profile = await verifyCounsellor(user);

        if (!profile) {

            await signOut(auth);

            window.location.replace("../counsellor-login.html");
            return;

        }

        currentCounsellor = {
            uid: user.uid,
            ...profile
        };

        displayCounsellorProfile(profile, user);

        listenForCounsellorRequests();

    } catch (error) {

        console.error(
            "COUNSELLOR AUTHORIZATION ERROR:",
            error
        );

        // Fail closed: do not leave unauthorized access available.
        await signOut(auth);

        window.location.replace("../counsellor-login.html");

    }

});