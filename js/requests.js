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
    where,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


// =====================================================
// PAGE ELEMENTS
// =====================================================

const loadingState =
    document.getElementById("loadingState");

const requestList =
    document.getElementById("requestList");

const emptyState =
    document.getElementById("emptyState");

const requestCount =
    document.getElementById("requestCount");

const navRequestCount =
    document.getElementById("navRequestCount");

const offlineNotice =
    document.getElementById("offlineNotice");

const requestError =
    document.getElementById("requestError");

const requestErrorMessage =
    document.getElementById("requestErrorMessage");

const retryButton =
    document.getElementById("retryButton");

const refreshButton =
    document.getElementById("refreshButton");

const onlineStatus =
    document.getElementById("onlineStatus");

const onlineStatusDot =
    document.getElementById("onlineStatusDot");

const onlineStatusText =
    document.getElementById("onlineStatusText");


// =====================================================
// STATE
// =====================================================

let currentUser = null;

let peerData = null;

let unsubscribeRequests = null;

let isPageReady = false;


// =====================================================
// SKIPPED REQUEST STORAGE
// =====================================================

const SKIPPED_REQUESTS_KEY =
    "smhos_skipped_requests";


// =====================================================
// INITIAL AUTH CHECK
// =====================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href =
            "../peer-login.html";

        return;
    }


    currentUser = user;


    try {

        await loadPeerProfile();

        isPageReady = true;

        startRequestsListener();

    } catch (error) {

        console.error(
            "Peer profile error:",
            error
        );

        showError(
            "Unable to verify your peer account."
        );

    }

});


// =====================================================
// LOAD PEER PROFILE
// =====================================================

async function loadPeerProfile() {

    const userRef =
        doc(
            db,
            "users",
            currentUser.uid
        );


    const snapshot =
        await getDoc(userRef);


    if (!snapshot.exists()) {

        await signOut(auth);

        window.location.href =
            "../peer-login.html";

        return;
    }


    peerData =
        snapshot.data();


    // ---------------------------------------------
    // ROLE CHECK
    // ---------------------------------------------

    if (peerData.role !== "peer") {

        await signOut(auth);

        window.location.href =
            "../peer-login.html";

        return;
    }


    // ---------------------------------------------
    // VERIFIED CHECK
    // ---------------------------------------------

    if (peerData.verified !== true) {

        await signOut(auth);

        window.location.href =
            "../peer-login.html";

        return;
    }


    updateOnlineStatus();

}


// =====================================================
// UPDATE ONLINE STATUS
// =====================================================

function updateOnlineStatus() {

    if (!peerData) return;


    const online =
        peerData.availability === "available";


    if (online) {

        onlineStatus.classList.add("online");

        onlineStatus.classList.remove(
            "offline"
        );

        onlineStatusDot.style.background =
            "#16834b";

        onlineStatusText.textContent =
            "Online";


        offlineNotice.hidden =
            true;

    } else {

        onlineStatus.classList.add("offline");

        onlineStatus.classList.remove(
            "online"
        );

        onlineStatusDot.style.background =
            "#999";

        onlineStatusText.textContent =
            "Offline";


        offlineNotice.hidden =
            false;
    }

}


// =====================================================
// START FIRESTORE LISTENER
// =====================================================

function startRequestsListener() {

    stopRequestsListener();


    // Show loading only while the listener
    // is waiting for its first response.
    showLoading();

    hideError();


    const requestsCollection =
        collection(
            db,
            "peerRequests"
        );


    /*
        IMPORTANT:

        We only use where(status == pending).

        We intentionally DO NOT use orderBy()
        here, avoiding unnecessary Firestore
        index requirements.
    */

    const requestsQuery =
        query(
            requestsCollection,
            where(
                "status",
                "==",
                "pending"
            )
        );


    unsubscribeRequests =
        onSnapshot(

            requestsQuery,

            (snapshot) => {

                // Firebase has responded.
                // Stop showing the loading state.
                hideLoading();

                renderRequests(
                    snapshot
                );

            },

            (error) => {

                console.error(
                    "Firestore request error:",
                    error
                );

                hideLoading();

                showError(
                    getFriendlyFirestoreError(
                        error
                    )
                );

            }

        );

}


// =====================================================
// STOP LISTENER
// =====================================================

function stopRequestsListener() {

    if (unsubscribeRequests) {

        unsubscribeRequests();

        unsubscribeRequests = null;
    }

}


// =====================================================
// SKIPPED REQUESTS
// =====================================================

function getSkippedRequestIds() {

    if (!currentUser) {
        return [];
    }


    const key =
        `${SKIPPED_REQUESTS_KEY}_${currentUser.uid}`;


    try {

        const saved =
            localStorage.getItem(key);


        if (!saved) {
            return [];
        }


        const parsed =
            JSON.parse(saved);


        return Array.isArray(parsed)
            ? parsed
            : [];


    } catch (error) {

        console.error(
            "Unable to read skipped requests:",
            error
        );

        return [];
    }

}


function skipRequest(requestId) {

    if (!currentUser) {
        return;
    }


    const key =
        `${SKIPPED_REQUESTS_KEY}_${currentUser.uid}`;


    const skipped =
        getSkippedRequestIds();


    if (!skipped.includes(requestId)) {

        skipped.push(requestId);


        localStorage.setItem(
            key,
            JSON.stringify(skipped)
        );

    }

}


// =====================================================
// RENDER REQUESTS
// =====================================================

function renderRequests(snapshot) {

    hideLoading();

    hideError();


    let requests = [];


    snapshot.forEach((requestSnapshot) => {

        const data =
            requestSnapshot.data();


        requests.push({

            id:
                requestSnapshot.id,

            ...data

        });

    });


    // ---------------------------------------------
    // SORT NEWEST FIRST
    // ---------------------------------------------

    requests.sort((a, b) => {

        const aTime =
            getTimestampMilliseconds(
                a.createdAt
            );


        const bTime =
            getTimestampMilliseconds(
                b.createdAt
            );


        return bTime - aTime;

    });


    // ---------------------------------------------
    // GET REQUESTS THIS PEER HAS SKIPPED
    // ---------------------------------------------

    const skippedRequestIds =
        getSkippedRequestIds();


    // ---------------------------------------------
    // FILTER REQUESTS
    // ---------------------------------------------

    requests =
        requests.filter(
            request => {

                const eligible =
                    requestCanBeShown(
                        request
                    );


                const skipped =
                    skippedRequestIds.includes(
                        request.id
                    );


                return eligible && !skipped;

            }
        );


    updateRequestCounters(
        requests.length
    );


    if (requests.length === 0) {

        showEmpty();

        return;
    }


    hideEmpty();

    requestList.hidden =
        false;


    requestList.innerHTML =
        "";


    requests.forEach(
        request => {

            const card =
                createRequestCard(
                    request
                );


            requestList.appendChild(
                card
            );

        }
    );

}


// =====================================================
// REQUEST ELIGIBILITY
// =====================================================

function requestCanBeShown(request) {

    /*
        POOL REQUEST
        --------------------
        Available to peers.
    */

    if (
        request.requestType ===
        "pool"
    ) {

        return true;
    }


    /*
        SPECIFIC REQUEST
        --------------------
        Only show it if this request
        actually identifies this peer.
    */

    if (
        request.requestType ===
        "specific"
    ) {

        return (
            request.selectedPeerId ===
            currentUser.uid
        );

    }


    /*
        Older requests may not have
        requestType.

        We allow them for now so the
        existing student system doesn't
        suddenly disappear.
    */

    return true;

}


// =====================================================
// CREATE REQUEST CARD
// =====================================================

function createRequestCard(request) {

    const card =
        document.createElement("article");


    card.className =
        "support-request-card";


    card.dataset.requestId =
        request.id;


    // ---------------------------------------------
    // Support type
    // ---------------------------------------------

    const supportType =
        formatText(
            request.supportType ||
            "Peer Support"
        );


    // ---------------------------------------------
    // Request type
    // ---------------------------------------------

    const requestType =
        request.requestType === "specific"
            ? "Specific Peer"
            : "Open Request";


    // ---------------------------------------------
    // Anonymous
    // ---------------------------------------------

    const isAnonymous =
        request.anonymous === true;


    // ---------------------------------------------
    // Gender preference
    // ---------------------------------------------

    const genderPreference =
        formatText(
            request.genderPreference ||
            ""
        );


    // ---------------------------------------------
    // Message
    // ---------------------------------------------

    const message =
        request.message ||
        "The student did not provide a message.";


    // ---------------------------------------------
    // Time
    // ---------------------------------------------

    const createdAt =
        formatTimestamp(
            request.createdAt
        );


    // ---------------------------------------------
    // Tags
    // ---------------------------------------------

    let tags = "";


    tags += `
        <span class="support-tag">
            ${escapeHTML(requestType)}
        </span>
    `;


    if (isAnonymous) {

        tags += `
            <span class="support-tag anonymous">
                Anonymous
            </span>
        `;

    } else {

        tags += `
            <span class="support-tag">
                Identity visible later
            </span>
        `;

    }


    if (genderPreference) {

        tags += `
            <span class="support-tag preference">
                Preference:
                ${escapeHTML(genderPreference)}
            </span>
        `;

    }


    // ---------------------------------------------
    // Card
    // ---------------------------------------------

    card.innerHTML = `

        <div class="support-request-header">

            <h2 class="support-request-title">
                ${escapeHTML(supportType)}
            </h2>

            <time class="support-request-time">
                ${escapeHTML(createdAt)}
            </time>

        </div>


        <div class="support-request-tags">

            ${tags}

        </div>


        <div class="support-request-message">

            <span class="message-label">
                Student message
            </span>

            ${escapeHTML(message)}

        </div>


        <div class="support-request-footer">

            <button
                type="button"
                class="request-button skip"
                data-action="skip"
            >
                Skip
            </button>

            <button
                type="button"
                class="request-button accept"
                data-action="accept"
            >
                Accept Request
            </button>

        </div>

    `;


    // ---------------------------------------------
    // Accept
    // ---------------------------------------------

    const acceptButton =
        card.querySelector(
            '[data-action="accept"]'
        );


    acceptButton.addEventListener(
        "click",
        () => {

            acceptRequest(
                request.id,
                card,
                acceptButton
            );

        }
    );


    // ---------------------------------------------
    // Skip
    // ---------------------------------------------

    const skipButton =
        card.querySelector(
            '[data-action="skip"]'
        );


    skipButton.addEventListener(
        "click",
        () => {

            // Save the skipped request locally
            // for this specific peer.
            skipRequest(
                request.id
            );


            // Remove it immediately from the page.
            card.remove();


            // Update the counters.
            updateVisibleCount();

        }
    );


    return card;

}


// =====================================================
// ACCEPT REQUEST
// =====================================================

async function acceptRequest(
    requestId,
    card,
    button
) {

    if (!currentUser || !peerData) {

        return;
    }


    // ---------------------------------------------
    // Peer must be online
    // ---------------------------------------------

    if (
        peerData.availability !==
        "available"
    ) {

        showTemporaryMessage(
            "Go online from your dashboard before accepting a request."
        );

        return;
    }


    button.disabled =
        true;


    button.textContent =
        "Accepting...";


    card.classList.add(
        "accepting"
    );


    try {

        const requestRef =
            doc(
                db,
                "peerRequests",
                requestId
            );


        await runTransaction(
            db,
            async (transaction) => {

                const requestSnapshot =
                    await transaction.get(
                        requestRef
                    );


                if (
                    !requestSnapshot.exists()
                ) {

                    throw new Error(
                        "REQUEST_NOT_FOUND"
                    );

                }


                const requestData =
                    requestSnapshot.data();


                // ---------------------------------
                // Check current status
                // ---------------------------------

                if (
                    requestData.status !==
                    "pending"
                ) {

                    throw new Error(
                        "REQUEST_ALREADY_TAKEN"
                    );

                }


                // ---------------------------------
                // Specific-peer check
                // ---------------------------------

                if (
                    requestData.requestType ===
                    "specific" &&

                    requestData.selectedPeerId &&

                    requestData.selectedPeerId !==
                    currentUser.uid
                ) {

                    throw new Error(
                        "NOT_ASSIGNED_PEER"
                    );

                }


                // ---------------------------------
                // ACCEPT
                // ---------------------------------

                transaction.update(
                    requestRef,
                    {

                        status:
                            "accepted",

                        acceptedBy:
                            currentUser.uid,

                        acceptedAt:
                            serverTimestamp(),

                        updatedAt:
                            serverTimestamp()

                    }
                );

            }
        );


        /*
            For now we simply move the request
            to "accepted".

            The Sessions system will later create
            the actual support session.
        */

        showTemporaryMessage(
            "Request accepted. Opening your sessions..."
        );


        setTimeout(
            () => {

                window.location.href =
                    "sessions.html";

            },
            900
        );


    } catch (error) {

        console.error(
            "Accept request error:",
            error
        );


        card.classList.remove(
            "accepting"
        );


        button.disabled =
            false;


        button.textContent =
            "Accept Request";


        if (
            error.message ===
            "REQUEST_ALREADY_TAKEN"
        ) {

            showTemporaryMessage(
                "This request has already been accepted by another peer."
            );


            card.remove();

            updateVisibleCount();


        } else if (
            error.message ===
            "REQUEST_NOT_FOUND"
        ) {

            showTemporaryMessage(
                "This request no longer exists."
            );


            card.remove();

            updateVisibleCount();


        } else if (
            error.message ===
            "NOT_ASSIGNED_PEER"
        ) {

            showTemporaryMessage(
                "This request was assigned to another peer."
            );


            card.remove();

            updateVisibleCount();


        } else {

            showTemporaryMessage(
                getFriendlyFirestoreError(
                    error
                )
            );

        }

    }

}


// =====================================================
// COUNTERS
// =====================================================

function updateRequestCounters(count) {

    requestCount.textContent =
        count;


    navRequestCount.textContent =
        count;


    if (count > 0) {

        navRequestCount.hidden =
            false;

    } else {

        navRequestCount.hidden =
            true;

    }

}


function updateVisibleCount() {

    if (!requestList) return;


    const cards =
        requestList.querySelectorAll(
            ".support-request-card"
        );


    updateRequestCounters(
        cards.length
    );


    if (cards.length === 0) {

        requestList.hidden =
            true;


        emptyState.hidden =
            false;

    }

}


// =====================================================
// LOADING
// =====================================================

function showLoading() {

    loadingState.hidden =
        false;


    requestList.hidden =
        true;


    emptyState.hidden =
        true;

}


function hideLoading() {

    loadingState.hidden =
        true;

}


// =====================================================
// EMPTY
// =====================================================

function showEmpty() {

    requestList.hidden =
        true;


    emptyState.hidden =
        false;

}


function hideEmpty() {

    emptyState.hidden =
        true;

}


// =====================================================
// ERROR
// =====================================================

function showError(message) {

    hideLoading();


    requestList.hidden =
        true;


    emptyState.hidden =
        true;


    requestErrorMessage.textContent =
        message;


    requestError.hidden =
        false;

}


function hideError() {

    requestError.hidden =
        true;

}


// =====================================================
// RETRY
// =====================================================

function retryLoading() {

    hideError();

    startRequestsListener();

}


if (retryButton) {

    retryButton.addEventListener(
        "click",
        retryLoading
    );

}


if (refreshButton) {

    refreshButton.addEventListener(
        "click",
        retryLoading
    );

}


// =====================================================
// FIRESTORE ERROR MESSAGES
// =====================================================

function getFriendlyFirestoreError(error) {

    if (!error) {

        return "Something went wrong while loading requests.";

    }


    if (
        error.code ===
        "permission-denied"
    ) {

        return (
            "Firebase denied access to support requests. " +
            "Your peer account or Firestore rules need to be checked."
        );

    }


    if (
        error.code ===
        "failed-precondition"
    ) {

        return (
            "Firebase requires an additional database configuration " +
            "before these requests can be loaded."
        );

    }


    if (
        error.code ===
        "unavailable"
    ) {

        return (
            "Firebase is temporarily unavailable. " +
            "Please check your internet connection."
        );

    }


    if (
        error.code ===
        "unauthenticated"
    ) {

        return (
            "Your peer session has expired. " +
            "Please sign in again."
        );

    }


    return (
        error.message ||
        "Unable to load support requests."
    );

}


// =====================================================
// TEMPORARY MESSAGE
// =====================================================

function showTemporaryMessage(message) {

    /*
        We use a normal browser alert for now.
        Later this can become an in-app toast system.
    */

    alert(message);

}


// =====================================================
// TIMESTAMP
// =====================================================

function getTimestampMilliseconds(
    timestamp
) {

    if (!timestamp) {

        return 0;
    }


    try {

        return timestamp
            .toDate()
            .getTime();

    } catch {

        return 0;

    }

}


function formatTimestamp(
    timestamp
) {

    if (!timestamp) {

        return "Just now";
    }


    try {

        const date =
            timestamp.toDate();


        return date.toLocaleString(
            undefined,
            {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );

    } catch {

        return "Recently";

    }

}


// =====================================================
// TEXT FORMATTING
// =====================================================

function formatText(value) {

    if (!value) {

        return "";
    }


    return String(value)
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


// =====================================================
// HTML SECURITY
// =====================================================

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// CLEANUP
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopRequestsListener();

    }
);