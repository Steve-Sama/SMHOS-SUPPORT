/* =====================================================
   SMHOS SUPPORT
   COUNSELLOR AUTHENTICATION
   Admin-approved accounts only
   ===================================================== */

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { auth, db } from "./firebase.js";


// =====================================================
// ELEMENTS
// =====================================================

const loginForm = document.getElementById("counsellorLoginForm");
const emailInput = document.getElementById("counsellorEmail");
const passwordInput = document.getElementById("counsellorPassword");
const loginButton = document.getElementById("counsellorLoginButton");
const errorBox = document.getElementById("counsellorLoginError");
const passwordToggle = document.getElementById("toggleCounsellorPassword");


// =====================================================
// CONFIGURATION
// =====================================================

const DASHBOARD_URL = "counsellor/dashboard.html";


// =====================================================
// ERROR DISPLAY
// =====================================================

function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
}

function hideError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
}


// =====================================================
// VERIFY COUNSELLOR AUTHORIZATION
// =====================================================

async function verifyCounsellorAccess(user) {

    const counsellorRef = doc(db, "counsellors", user.uid);
    const counsellorSnap = await getDoc(counsellorRef);

    if (!counsellorSnap.exists()) {
        return false;
    }

    const counsellorData = counsellorSnap.data();

    return (
        counsellorData.role === "counsellor" &&
        counsellorData.approved === true
    );
}


// =====================================================
// LOGIN FORM
// =====================================================

if (loginForm) {

    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        hideError();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError("Please enter your email and password.");
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Signing in...";

        let authenticatedUser = null;

        try {

            // Sign in using Firebase Authentication.
            const credential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            authenticatedUser = credential.user;

            // Verify that this account is an approved counsellor.
            const isApproved = await verifyCounsellorAccess(
                authenticatedUser
            );

            if (!isApproved) {

                await signOut(auth);
                authenticatedUser = null;

                showError(
                    "Access denied. This account is not registered " +
                    "as an approved SMHOS counsellor. Please contact " +
                    "the system administrator."
                );

                return;
            }

            // Approved counsellor: open dashboard.
            window.location.replace(DASHBOARD_URL);

        } catch (error) {

            console.error("COUNSELLOR LOGIN ERROR:", error);

            // If authorization checking fails, do not leave the
            // account signed in.
            if (authenticatedUser) {
                try {
                    await signOut(auth);
                } catch (signOutError) {
                    console.error(
                        "SIGN-OUT ERROR:",
                        signOutError
                    );
                }
            }

            if (error.code === "auth/invalid-credential") {

                showError(
                    "Incorrect email or password."
                );

            } else if (
                error.code === "auth/too-many-requests"
            ) {

                showError(
                    "Too many unsuccessful attempts. Please try again later."
                );

            } else if (
                error.code === "permission-denied"
            ) {

                showError(
                    "Unable to verify your counsellor access. " +
                    "Please contact the administrator."
                );

            } else {

                showError(
                    "We couldn't sign you in. Check your connection " +
                    "and try again."
                );
            }

        } finally {

            loginButton.disabled = false;
            loginButton.textContent = "Sign In";

        }

    });

}


// =====================================================
// SHOW / HIDE PASSWORD
// =====================================================

if (passwordToggle && passwordInput) {

    passwordToggle.addEventListener("click", () => {

        const passwordIsHidden =
            passwordInput.type === "password";

        passwordInput.type = passwordIsHidden
            ? "text"
            : "password";

        passwordToggle.textContent = passwordIsHidden
            ? "Hide"
            : "Show";

    });

}


// =====================================================
// EXISTING SESSION CHECK
// =====================================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        return;
    }

    try {

        const isApproved = await verifyCounsellorAccess(user);

        if (isApproved) {

            // Avoid redirecting repeatedly if already on dashboard.
            if (
                !window.location.pathname.endsWith(
                    "/counsellor/dashboard.html"
                )
            ) {
                window.location.replace(DASHBOARD_URL);
            }

        } else {

            await signOut(auth);

        }

    } catch (error) {

        console.error(
            "COUNSELLOR SESSION VERIFICATION ERROR:",
            error
        );

        await signOut(auth);

    }

});