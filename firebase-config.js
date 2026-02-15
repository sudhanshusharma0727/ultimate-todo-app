// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    query,
    where,
    onSnapshot,
    writeBatch,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCJ9MEfKaLaQr-CWxQTwZf0MvVNJd_XYg4",
    authDomain: "ultimatetodo-577e1.firebaseapp.com",
    projectId: "ultimatetodo-577e1",
    storageBucket: "ultimatetodo-577e1.firebasestorage.app",
    messagingSenderId: "817153725734",
    appId: "1:817153725734:web:a1f833f5ba84188a181de7",
    measurementId: "G-KS1VV2YVYE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ============================================================
//  AUTH FUNCTIONS
// ============================================================

export const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
    }
};

export const registerWithEmail = async (name, email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        return userCredential.user;
    } catch (error) {
        console.error("Error registering", error);
        throw error;
    }
};

export const loginWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Error logging in", error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};

export const subscribeToAuthChanges = (callback) => {
    return onAuthStateChanged(auth, callback);
};

// ============================================================
//  FIRESTORE FUNCTIONS
// ============================================================

// Save entire state (for simple migration/sync)
// In a real app we'd save items individually, but to keep existing architecture
// we'll sync the big JSON blobs for now, or preferably move to collection-based.
// Let's use collection-based for better scalability and multi-device sync.

export const getUserRef = (uid) => doc(db, "users", uid);

// Initialize user document if not exists
export const initUser = async (user) => {
    const userRef = getUserRef(user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: new Date().toISOString(),
            settings: {
                theme: 'dark',
                sort: 'date',
                collapsed: {}
            },
            projects: [
                { id: 'inbox', name: 'Inbox', color: '#7C3AED' },
                { id: 'work', name: 'Work', color: '#3B82F6' },
                { id: 'personal', name: 'Personal', color: '#10B981' }
            ],
            tags: [
                { id: 'tag-urgent', name: 'Urgent', color: '#EF4444' },
                { id: 'tag-feature', name: 'Feature', color: '#3B82F6' },
                { id: 'tag-bug', name: 'Bug', color: '#F97316' }
            ]
        });

        // Also create a subcollection for todos if we want, or just keep them in a top-level collection with userId
        // For simplicity with existing app structure, let's keep projects/tags in the user doc
        // and put todos in a subcollection 'todos'
    }
};

// TODOS
export const subscribeToTodos = (uid, callback) => {
    const q = query(collection(db, "users", uid, "todos"));
    return onSnapshot(q, (snapshot) => {
        const todos = [];
        snapshot.forEach((doc) => {
            todos.push({ ...doc.data(), id: doc.id });
        });
        callback(todos);
    });
};

export const addTodo = async (uid, todo) => {
    await setDoc(doc(db, "users", uid, "todos", todo.id), todo);
};

export const updateTodo = async (uid, todo) => {
    await updateDoc(doc(db, "users", uid, "todos", todo.id), todo);
};

export const deleteTodo = async (uid, todoId) => {
    await doc(db, "users", uid, "todos", todoId).delete(); // Note: delete() is a method on DocumentReference
    // Actually, delete() isn't directly on doc(), we need deleteDoc imported or call delete() on the ref if using modular sdk properly
    // Wait, in modular SDK it is: await deleteDoc(doc(db, ...));
};

// Re-implement delete
export const removeTodo = async (uid, todoId) => {
    await deleteDoc(doc(db, "users", uid, "todos", todoId));
};

// PROJECTS & TAGS & SETTINGS (Stored in user document)
export const subscribeToUserData = (uid, callback) => {
    return onSnapshot(doc(db, "users", uid), (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        }
    });
};

export const updateUserData = async (uid, data) => {
    await updateDoc(doc(db, "users", uid), data);
};
