import { loginWithGoogle, registerWithEmail, loginWithEmail, subscribeToAuthChanges } from './firebase-config.js';

const authForm = document.getElementById('auth-form');
const nameGroup = document.getElementById('name-group');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.querySelector('.btn-text');
const spinner = document.querySelector('.spinner');
const googleBtn = document.getElementById('google-btn');
const switchBtn = document.getElementById('switch-btn');
const switchText = document.getElementById('switch-text');
const authTitle = document.getElementById('auth-title');
const errorMsg = document.getElementById('error-msg');

let isLogin = true;

// Check if already logged in
subscribeToAuthChanges((user) => {
    if (user) {
        window.location.href = 'index.html';
    }
});

function toggleAuthMode() {
    isLogin = !isLogin;
    if (isLogin) {
        authTitle.textContent = 'Sign in to continue';
        nameGroup.style.display = 'none';
        nameInput.required = false;
        btnText.textContent = 'Sign In';
        switchText.textContent = "Don't have an account?";
        switchBtn.textContent = 'Sign up';
    } else {
        authTitle.textContent = 'Create your account';
        nameGroup.style.display = 'flex';
        nameInput.required = true;
        btnText.textContent = 'Sign Up';
        switchText.textContent = 'Already have an account?';
        switchBtn.textContent = 'Sign in';
    }
    errorMsg.textContent = '';
}

function setLoading(loading) {
    if (loading) {
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.classList.remove('hidden');
    } else {
        submitBtn.disabled = false;
        btnText.style.display = 'block';
        spinner.classList.add('hidden');
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    setLoading(false);
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    errorMsg.textContent = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const name = nameInput.value.trim();

    try {
        if (isLogin) {
            await loginWithEmail(email, password);
        } else {
            await registerWithEmail(name, email, password);
        }
        // Redirect handled by onAuthStateChanged
    } catch (error) {
        let msg = 'An error occurred. Please try again.';
        if (error.code === 'auth/invalid-email') msg = 'Invalid email address.';
        else if (error.code === 'auth/user-disabled') msg = 'User account is disabled.';
        else if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';
        else if (error.code === 'auth/wrong-password') msg = 'Incorrect password.';
        else if (error.code === 'auth/email-already-in-use') msg = 'Email is already in use.';
        else if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
        else if (error.code === 'auth/invalid-credential') msg = 'Invalid credentials.';
        else if (error.code === 'auth/operation-not-allowed') msg = 'Email/Password login is not enabled in Firebase Console.';
        else msg = 'Error: ' + error.message + ' (' + error.code + ')';
        showError(msg);
    }
});

googleBtn.addEventListener('click', async () => {
    try {
        await loginWithGoogle();
        // Redirect handled by onAuthStateChanged
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/popup-closed-by-user') return;
        showError('Google Error: ' + error.message);
    }
});

switchBtn.addEventListener('click', toggleAuthMode);
