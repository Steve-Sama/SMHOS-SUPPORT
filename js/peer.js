import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";


// =====================================================
// LOGIN ELEMENTS
// =====================================================

const loginForm =
    document.getElementById("peerLoginForm");

const loginButton =
    document.getElementById("loginButton");

const loginError =
    document.getElementById("loginError");


// =====================================================
// DASHBOARD ELEMENTS
// =====================================================

const peerName =
    document.getElementById("peerName");

const peerStatus =
    document.getElementById("peerStatus");

const peerStatusText =
    document.getElementById("peerStatusText");

const availabilityHeading =
    document.getElementById("availabilityHeading");

const availabilityDescription =
    document.getElementById("availabilityDescription");

const availabilityButton =
    document.getElementById("availabilityButton");

const peerLogoutButton =
    document.getElementById("peerLogoutButton");


// =====================================================
// DASHBOARD REQUEST ELEMENTS
// =====================================================

const dashboardRequestLoading =
    document.getElementById(
        "dashboardRequestLoading"
    );

const dashboardRequestEmpty =
    document.getElementById(
        "dashboardRequestEmpty"
    );

const dashboardRequestPreview =
    document.getElementById(
        "dashboardRequestPreview"
    );

const dashboardRequestType =
    document.getElementById(
        "dashboardRequestType"
    );

const dashboardRequestMessage =
    document.getElementById(
        "dashboardRequestMessage"
    );

const dashboardRequestTime =
    document.getElementById(
        "dashboardRequestTime"
    );


// =====================================================
// REQUEST PAGE ELEMENTS
// =====================================================

const requestContainer =
    document.getElementById("requestContainer");

const requestCount =
    document.getElementById("requestCount");

const offlineNotice =
    document.getElementById("offlineNotice");


// =====================================================
// GLOBAL VARIABLES
// =====================================================

let currentUser = null;

let peerData = null;

let unsubscribeRequests = null;

let dashboardRequestsUnsubscribe = null;





const SKIPPED_REQUESTS_KEY = "smhos_skipped_requests";


function getSkippedRequestIds() {
    try {
        if (!currentUser) {
            return [];
        }

        const key =
            `${SKIPPED_REQUESTS_KEY}_${currentUser.uid}`;

        const saved = localStorage.getItem(key);

        if (!saved) {
            return [];
        }

        const parsed = JSON.parse(saved);

        return Array.isArray(parsed) ? parsed : [];

    } catch (error) {
        console.error(
            "Unable to read skipped requests:",
            error
        );

        return [];
    }
}






// =====================================================
// LOGIN ERROR HELPERS
// =====================================================

function showError(message) {

    if (!loginError) return;

    loginError.textContent =
        message;

    loginError.hidden =
        false;
}


function hideError() {

    if (!loginError) return;

    loginError.textContent =
        "";

    loginError.hidden =
        true;
}


// =====================================================
// AUTHENTICATION
// =====================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            currentUser = null;
            peerData = null;

            stopRequestListener();

            stopDashboardRequestListener();

            return;
        }


        currentUser = user;


        try {

            const userRef =
                doc(
                    db,
                    "users",
                    user.uid
                );


            const userSnapshot =
                await getDoc(userRef);


            if (!userSnapshot.exists()) {

                await signOut(auth);


                if (
                    window.location.pathname.includes(
                        "/peer/"
                    )
                ) {

                    window.location.href =
                        "../peer-login.html";

                }

                return;
            }


            peerData =
                userSnapshot.data();


            // -----------------------------------------
            // Make sure this is actually a peer.
            // -----------------------------------------

            if (
                peerData.role !==
                "peer"
            ) {

                await signOut(auth);

                window.location.href =
                    "../peer-login.html";

                return;
            }


            // -----------------------------------------
            // Peer must be verified.
            // -----------------------------------------

            if (
                peerData.verified !==
                true
            ) {

                await signOut(auth);

                window.location.href =
                    "../peer-login.html";

                return;
            }


            // -----------------------------------------
            // Display peer name.
            // -----------------------------------------

            if (peerName) {

                peerName.textContent =
                    peerData.name ||
                    "Peer";
            }


            // -----------------------------------------
            // Dashboard availability.
            // -----------------------------------------

            if (availabilityButton) {

                updateAvailabilityUI();
            }


            // -----------------------------------------
            // Dashboard pending requests.
            // -----------------------------------------

            if (dashboardRequestPreview) {

                startDashboardRequestListener();
            }


            // -----------------------------------------
            // Request page.
            // -----------------------------------------

            if (requestContainer) {

                updateRequestPageStatus();

                startRequestListener();
            }


        } catch (error) {

            console.error(
                "Peer authentication error:",
                error
            );

        }

    }
);


// =====================================================
// PEER LOGIN
// =====================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            hideError();


            const email =
                document
                    .getElementById("email")
                    .value
                    .trim();


            const password =
                document
                    .getElementById("password")
                    .value;


            if (!email || !password) {

                showError(
                    "Please enter your email and password."
                );

                return;
            }


            loginButton.disabled =
                true;

            loginButton.textContent =
                "Signing in...";


            try {

                const credential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    credential.user;


                const userRef =
                    doc(
                        db,
                        "users",
                        user.uid
                    );


                const userSnapshot =
                    await getDoc(userRef);


                if (
                    !userSnapshot.exists()
                ) {

                    await signOut(auth);

                    showError(
                        "Your account does not have an SMHOS support profile."
                    );

                    return;
                }


                const userData =
                    userSnapshot.data();


                if (
                    userData.role !==
                    "peer"
                ) {

                    await signOut(auth);

                    showError(
                        "This account is not registered as a Peer Listener."
                    );

                    return;
                }


                if (
                    userData.verified !==
                    true
                ) {

                    await signOut(auth);

                    showError(
                        "Your Peer Listener account has not been verified yet."
                    );

                    return;
                }


                window.location.href =
                    "peer/dashboard.html";


            } catch (error) {

                console.error(
                    "Peer login error:",
                    error
                );


                let message =
                    "Unable to sign in. Please try again.";


                if (
                    error.code ===
                    "auth/invalid-credential"
                ) {

                    message =
                        "Incorrect email or password.";

                } else if (
                    error.code ===
                    "auth/too-many-requests"
                ) {

                    message =
                        "Too many login attempts. Please try again later.";

                } else if (
                    error.code ===
                    "auth/network-request-failed"
                ) {

                    message =
                        "Network error. Please check your internet connection.";

                }


                showError(message);


            } finally {

                loginButton.disabled =
                    false;

                loginButton.textContent =
                    "Sign In";
            }

        }
    );

}


// =====================================================
// AVAILABILITY UI
// =====================================================

function updateAvailabilityUI() {

    if (
        !peerData ||
        !availabilityButton
    ) {
        return;
    }


    const isOnline =
        peerData.availability ===
        "available";


    if (isOnline) {

        peerStatus.classList.remove(
            "offline"
        );

        peerStatus.classList.add(
            "online"
        );


        peerStatusText.textContent =
            "Online";


        availabilityHeading.textContent =
            "You're currently online";


        availabilityDescription.textContent =
            "You'll receive student support requests while you're online.";


        availabilityButton.textContent =
            "Go Offline";


        availabilityButton.classList.remove(
            "offline"
        );


    } else {

        peerStatus.classList.remove(
            "online"
        );

        peerStatus.classList.add(
            "offline"
        );


        peerStatusText.textContent =
            "Offline";


        availabilityHeading.textContent =
            "You're currently offline";


        availabilityDescription.textContent =
            "Go online when you're ready to receive student support requests.";


        availabilityButton.textContent =
            "Go Online";


        availabilityButton.classList.add(
            "offline"
        );

    }

}


// =====================================================
// AVAILABILITY BUTTON
// =====================================================

if (availabilityButton) {

    availabilityButton.addEventListener(
        "click",
        async () => {

            if (
                !currentUser ||
                !peerData
            ) {
                return;
            }


            const isCurrentlyOnline =
                peerData.availability ===
                "available";


            const newAvailability =
                isCurrentlyOnline
                    ? "offline"
                    : "available";


            availabilityButton.disabled =
                true;


            try {

                const peerRef =
                    doc(
                        db,
                        "users",
                        currentUser.uid
                    );


                await updateDoc(
                    peerRef,
                    {

                        availability:
                            newAvailability,

                        availabilityUpdatedAt:
                            serverTimestamp()

                    }
                );


                peerData.availability =
                    newAvailability;


                updateAvailabilityUI();

                updateRequestPageStatus();


            } catch (error) {

                console.error(
                    "Availability update failed:",
                    error
                );


                alert(
                    "Unable to update your availability. Please try again."
                );


            } finally {

                availabilityButton.disabled =
                    false;
            }

        }
    );

}


// =====================================================
// DASHBOARD REQUEST LISTENER
// =====================================================

function startDashboardRequestListener() {

    if (
        !dashboardRequestPreview
    ) {
        return;
    }


    // Stop an existing listener first.
    stopDashboardRequestListener();


    // Show loading state.
    if (dashboardRequestLoading) {

        dashboardRequestLoading.hidden =
            false;
    }


    if (dashboardRequestEmpty) {

        dashboardRequestEmpty.hidden =
            true;
    }


    dashboardRequestPreview.hidden =
        true;


    const requestsRef =
        collection(
            db,
            "peerRequests"
        );


    /*
        We only request pending support requests.

        We do NOT use orderBy() here.

        This avoids requiring an additional
        Firestore composite index.
    */

    const requestsQuery =
        query(
            requestsRef,
            where(
                "status",
                "==",
                "pending"
            )
        );


    dashboardRequestsUnsubscribe =
        onSnapshot(

            requestsQuery,

            (snapshot) => {

                if (dashboardRequestLoading) {

                    dashboardRequestLoading.hidden =
                        true;
                }


                let requests = [];


                snapshot.forEach(
                    (requestDoc) => {

                        const data =
                            requestDoc.data();


                        requests.push({

                            id:
                                requestDoc.id,

                            ...data

                        });

                    }
                );


                const skippedRequestIds = getSkippedRequestIds();

               requests = requests.filter(
               request => !skippedRequestIds.includes(request.id)
                 );


                // -------------------------------------
                // Only show requests relevant to this
                // peer.
                // -------------------------------------

                requests =
                    requests.filter(
                        request => {

                            // Open/pool requests
                            // are available to peers.

                            if (
                                request.requestType ===
                                "pool"
                            ) {

                                return true;
                            }


                            // Specific requests should
                            // only appear for the selected
                            // peer.

                            if (
                                request.requestType ===
                                "specific"
                            ) {

                                return (
                                    request.selectedPeerId ===
                                    currentUser.uid
                                );

                            }


                            // Older requests without a
                            // requestType remain visible.

                            return true;

                        }
                    );


                // -------------------------------------
                // Sort newest first.
                // -------------------------------------

                requests.sort(
                    (a, b) => {

                        const aTime =
                            a.createdAt
                                ?.toMillis?.() ||
                            0;


                        const bTime =
                            b.createdAt
                                ?.toMillis?.() ||
                            0;


                        return (
                            bTime -
                            aTime
                        );

                    }
                );


                // -------------------------------------
                // No requests.
                // -------------------------------------

                if (
                    requests.length ===
                    0
                ) {

                    if (
                        dashboardRequestEmpty
                    ) {

                        dashboardRequestEmpty.hidden =
                            false;
                    }


                    if (
                        dashboardRequestPreview
                    ) {

                        dashboardRequestPreview.hidden =
                            true;
                    }


                    return;
                }


                // -------------------------------------
                // We have at least one request.
                // -------------------------------------

                const newest =
                    requests[0];


                if (
                    dashboardRequestEmpty
                ) {

                    dashboardRequestEmpty.hidden =
                        true;
                }


                if (
                    dashboardRequestPreview
                ) {

                    dashboardRequestPreview.hidden =
                        false;
                }


                if (
                    dashboardRequestType
                ) {

                    dashboardRequestType.textContent =
                        formatPeerRequestText(
                            newest.supportType ||
                            "Peer Support"
                        );
                }


                if (
                    dashboardRequestMessage
                ) {

                    dashboardRequestMessage.textContent =
                        newest.message ||
                        "A student is waiting for peer support.";
                }


                if (
                    dashboardRequestTime
                ) {

                    dashboardRequestTime.textContent =
                        formatPeerRequestTime(
                            newest.createdAt
                        );
                }

            },


            (error) => {

                console.error(
                    "Dashboard request listener error:",
                    error
                );


                if (
                    dashboardRequestLoading
                ) {

                    dashboardRequestLoading.hidden =
                        true;
                }


                if (
                    dashboardRequestPreview
                ) {

                    dashboardRequestPreview.hidden =
                        true;
                }


                if (
                    dashboardRequestEmpty
                ) {

                    dashboardRequestEmpty.hidden =
                        false;
                }

            }

        );

}


// =====================================================
// STOP DASHBOARD REQUEST LISTENER
// =====================================================

function stopDashboardRequestListener() {

    if (
        dashboardRequestsUnsubscribe
    ) {

        dashboardRequestsUnsubscribe();

        dashboardRequestsUnsubscribe =
            null;
    }

}


// =====================================================
// DASHBOARD REQUEST TEXT
// =====================================================

function formatPeerRequestText(
    value
) {

    return String(value)

        .replace(
            /_/g,
            " "
        )

        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


// =====================================================
// DASHBOARD REQUEST TIME
// =====================================================

function formatPeerRequestTime(
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
// REQUEST PAGE STATUS
// =====================================================

function updateRequestPageStatus() {

    if (
        !offlineNotice ||
        !peerData
    ) {
        return;
    }


    const isOnline =
        peerData.availability ===
        "available";


    if (isOnline) {

        offlineNotice.style.display =
            "none";

    } else {

        offlineNotice.style.display =
            "block";

    }

}


// =====================================================
// START REQUEST LISTENER
// =====================================================

function startRequestListener() {

    if (!requestContainer) {
        return;
    }


    stopRequestListener();


    const requestsRef =
        collection(
            db,
            "peerRequests"
        );


    const requestsQuery =
        query(
            requestsRef,
            where(
                "status",
                "==",
                "pending"
            ),
            orderBy(
                "createdAt",
                "desc"
            )
        );


    unsubscribeRequests =
        onSnapshot(

            requestsQuery,

            (snapshot) => {

                renderRequests(
                    snapshot
                );

            },

            (error) => {

                console.error(
                    "Request listener error:",
                    error
                );


                requestContainer.innerHTML = `

                    <div class="error-state">

                        Unable to load support requests.

                        Please check your connection
                        and try again.

                    </div>

                `;

            }

        );

}


// =====================================================
// STOP REQUEST LISTENER
// =====================================================

function stopRequestListener() {

    if (unsubscribeRequests) {

        unsubscribeRequests();

        unsubscribeRequests =
            null;
    }

}


// =====================================================
// RENDER REQUESTS
// =====================================================

function renderRequests(
    snapshot
) {

    if (!requestContainer) {
        return;
    }


    requestCount.textContent =
        snapshot.size;


    if (snapshot.empty) {

        requestContainer.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ♡
                </div>

                <h3>
                    No pending requests
                </h3>

                <p>
                    There are currently no students waiting
                    for peer support.
                </p>

            </div>

        `;

        return;
    }


    requestContainer.innerHTML =
        "";


    snapshot.forEach(
        (requestDoc) => {

            const data =
                requestDoc.data();


            const card =
                createRequestCard(
                    requestDoc.id,
                    data
                );


            requestContainer.appendChild(
                card
            );

        }
    );

}


// =====================================================
// CREATE REQUEST CARD
// =====================================================

function createRequestCard(
    requestId,
    data
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "request-card";


    // ---------------------------------------------
    // Support type
    // ---------------------------------------------

    let supportType =
        data.supportType ||
        "Peer Support";


    supportType =
        formatText(
            supportType
        );


    // ---------------------------------------------
    // Anonymous status
    // ---------------------------------------------

    const anonymous =
        data.anonymous === true;


    // ---------------------------------------------
    // Gender preference
    // ---------------------------------------------

    let genderPreference =
        data.genderPreference ||
        "";


    genderPreference =
        formatText(
            genderPreference
        );


    // ---------------------------------------------
    // Message
    // ---------------------------------------------

    const message =
        data.message ||
        "The student did not provide a message.";


    // ---------------------------------------------
    // Created time
    // ---------------------------------------------

    const createdTime =
        formatTimestamp(
            data.createdAt
        );


    // ---------------------------------------------
    // Build tags
    // ---------------------------------------------

    let tagsHTML =
        "";


    if (anonymous) {

        tagsHTML += `

            <span class="request-tag anonymous">
                Anonymous
            </span>

        `;

    }


    if (genderPreference) {

        tagsHTML += `

            <span class="request-tag">

                Preference:
                ${escapeHTML(genderPreference)}

            </span>

        `;

    }


    // ---------------------------------------------
    // Card HTML
    // ---------------------------------------------

    card.innerHTML = `

        <div class="request-top">

            <div class="request-type">

                ${escapeHTML(supportType)}

            </div>


            <div class="request-time">

                ${escapeHTML(createdTime)}

            </div>

        </div>


        <div class="request-tags">

            ${tagsHTML}

        </div>


        <div class="request-message">

            ${escapeHTML(message)}

        </div>


        <div class="request-actions">

            <button
                class="decline-button"
                type="button"
                data-action="decline"
            >
                Skip
            </button>


            <button
                class="accept-button"
                type="button"
                data-action="accept"
            >
                Accept Request
            </button>

        </div>

    `;


    // ---------------------------------------------
    // Accept button
    // ---------------------------------------------

    const acceptButton =
        card.querySelector(
            '[data-action="accept"]'
        );


    acceptButton.addEventListener(
        "click",
        async () => {

            await acceptRequest(
                requestId,
                acceptButton
            );

        }
    );


    // ---------------------------------------------
    // Decline / skip
    // ---------------------------------------------

    const declineButton =
        card.querySelector(
            '[data-action="decline"]'
        );


    declineButton.addEventListener(
        "click",
        () => {

            card.remove();

            updateVisibleRequestCount();

        }
    );


    return card;

}


// =====================================================
// ACCEPT REQUEST
// =====================================================

async function acceptRequest(
    requestId,
    button
) {

    if (
        !currentUser ||
        !peerData
    ) {

        alert(
            "Your peer account is not ready."
        );

        return;
    }


    if (
        peerData.availability !==
        "available"
    ) {

        alert(
            "Please go online before accepting a support request."
        );

        return;
    }


    button.disabled =
        true;

    button.textContent =
        "Accepting...";


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


                // Someone else already accepted it.

                if (
                    requestData.status !==
                    "pending"
                ) {

                    throw new Error(
                        "REQUEST_ALREADY_TAKEN"
                    );

                }


                // Specific-peer request check.

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


        alert(
            "Support request accepted."
        );


    } catch (error) {

        console.error(
            "Accept request failed:",
            error
        );


        if (
            error.message ===
            "REQUEST_ALREADY_TAKEN"
        ) {

            alert(
                "This request has already been accepted by another peer."
            );


        } else if (
            error.message ===
            "REQUEST_NOT_FOUND"
        ) {

            alert(
                "This support request no longer exists."
            );


        } else {

            alert(
                "Unable to accept this request. Please try again."
            );

        }


        button.disabled =
            false;

        button.textContent =
            "Accept Request";

    }

}


// =====================================================
// UPDATE VISIBLE COUNT
// =====================================================

function updateVisibleRequestCount() {

    if (
        !requestContainer ||
        !requestCount
    ) {

        return;
    }


    const cards =
        requestContainer.querySelectorAll(
            ".request-card"
        );


    requestCount.textContent =
        cards.length;

}


// =====================================================
// FORMAT TEXT
// =====================================================

function formatText(value) {

    if (!value) {
        return "";
    }


    return String(value)

        .replace(
            /_/g,
            " "
        )

        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


// =====================================================
// FORMAT FIRESTORE TIMESTAMP
// =====================================================

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


    } catch (error) {

        return "Recently";

    }

}


// =====================================================
// ESCAPE HTML
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
// LOGOUT
// =====================================================

if (peerLogoutButton) {

    peerLogoutButton.addEventListener(
        "click",
        async () => {

            try {

                stopRequestListener();

                stopDashboardRequestListener();


                await signOut(
                    auth
                );


                window.location.href =
                    "../peer-login.html";


            } catch (error) {

                console.error(
                    "Logout failed:",
                    error
                );

            }

        }
    );

}


// =====================================================
// CLEANUP
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopRequestListener();

        stopDashboardRequestListener();

    }
);