# Ultimate Todo App

A feature-rich, beautiful, and powerful To-Do application built with **Vanilla JavaScript**, **Firebase**, and **Glassmorphism Design**.

![App Screenshot](https://raw.githubusercontent.com/sudhanshusharma0727/ultimate-todo-app/master/screenshot.png)
*(Note: Add a screenshot called screenshot.png to your repo for this image to show up)*

## 🚀 Live Demo
[https://sudhanshusharma0727.github.io/ultimate-todo-app/](https://sudhanshusharma0727.github.io/ultimate-todo-app/)

## ✨ Features

### 🔐 User Authentication & Cloud Sync
*   **Secure Login:** Sign in with Google or Email/Password via Firebase Auth.
*   **Real-time Sync:** Tasks, projects, and settings sync instantly across all your devices using Cloud Firestore.
*   **Private Data:** Every user has their own isolated data environment.

### 🎯 Task Management
*   **Smart Views:** Inbox, Today, Upcoming, Overdue, and Completed filters.
*   **Rich Task Details:** Add subtasks, notes, priority levels, and recurring schedules (daily, weekly, monthly).
*   **Organization:** Create custom **Projects** (with colors) and **Tags** to organize your workflow.
*   **Drag & Drop:** (Coming soon) Reorder tasks easily.

### 🍅 Productivity Tools
*   **Pomodoro Timer:** Integrated focus timer with customizable intervals and session tracking.
*   **Analytics Dashboard:** Visual charts showing completion rates, activity heatmaps, and priority distribution.
*   **Gamification:** Confetti celebration when completing all tasks for the day!

### 🎨 UI/UX
*   **Glassmorphism Design:** Modern, sleek interface with blur effects and smooth animations.
*   **Theme System:** Built-in Dark/Light mode toggle.
*   **Responsive:** Fully optimized for desktop, tablet, and mobile.
*   **Keyboard Shortcuts:**
    *   `N` - New Task
    *   `/` - Search
    *   `P` - Toggle Pomodoro
    *   `D` - Toggle Theme
    *   `?` - Show Shortcuts

## 🛠️ Tech Stack

*   **Frontend:** HTML5, CSS3 (Variables, Flexbox, Grid), Vanilla JavaScript (ES6+ Modules).
*   **Backend:** Firebase Authentication, Cloud Firestore.
*   **Hosting:** GitHub Pages.
*   **Design:** CSS Glassmorphism, Phosphor Icons (via SVG).

## ⚙️ Setup & Installation

If you want to run this locally or fork it:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sudhanshusharma0727/ultimate-todo-app.git
    cd ultimate-todo-app
    ```

2.  **Set up Firebase:**
    *   Go to [Firebase Console](https://console.firebase.google.com).
    *   Create a new project.
    *   Enable **Authentication** (Google & Email/Password).
    *   Enable **Cloud Firestore** (Start in Test Mode).
    *   Create a Web App in Project Settings and get your config.

3.  **Configure the App:**
    *   Open `firebase-config.js`.
    *   Replace the `firebaseConfig` object with your own credentials:
        ```javascript
        const firebaseConfig = {
          apiKey: "YOUR_API_KEY",
          authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
          projectId: "YOUR_PROJECT_ID",
          storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
          messagingSenderId: "YOUR_SENDER_ID",
          appId: "YOUR_APP_ID"
        };
        ```

4.  **Run Locally:**
    *   Since the app uses ES Modules, you need a local server.
    *   Using Python: `python -m http.server`
    *   Using Node/VS Code: Use the "Live Server" extension.

## 📦 Deployment

This project is configured to deploy to **GitHub Pages** automatically via GitHub Actions.

1.  Push your code to GitHub.
2.  Go to Settings > Pages.
3.  The included `.github/workflows/deploy.yml` handling the build process will automatically deploy changes from the `master` (or `main`) branch.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
