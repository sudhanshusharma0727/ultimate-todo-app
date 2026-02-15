# Ultimate Todo App

A feature-rich, beautiful, and powerful To-Do application built with **Vanilla JavaScript**, **Firebase**, and **Glassmorphism Design**.

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
    *   Enable **Cloud Firestore**.
    *   **Deploy Security Rules:** Copy the rules from `firestore.rules.example` and paste them in Firebase Console → Firestore → Rules → Publish.
    *   Create a Web App in Project Settings and get your config.

3.  **Configure the App:**
    *   Copy the example config file:
        ```bash
        cp firebase-config.example.js firebase-config.js
        ```
    *   Open `firebase-config.js` and replace the placeholder values with your Firebase credentials.
    *   **⚠️ Never commit `firebase-config.js` to git** — it's already in `.gitignore`.

4.  **Run Locally:**
    *   Since the app uses ES Modules, you need a local server.
    *   Using Python: `python -m http.server`
    *   Using Node/VS Code: Use the "Live Server" extension.

## 🔒 Security

### Firebase API Key
The Firebase API key is kept out of version control via `.gitignore`. While Firebase web API keys are designed to be public (security comes from Firestore rules and Auth restrictions), keeping them out of git is best practice.

**Recommended:** Restrict your API key in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to only allow requests from your domain.

### Firestore Security Rules
**Do NOT use Test Mode in production.** Deploy the rules from `firestore.rules.example` to ensure:
*   Users can only read/write their own data
*   Unauthenticated users have zero access
*   Todo subcollection is scoped per user

## 📦 Deployment

This project is configured to deploy to **GitHub Pages** automatically via GitHub Actions.

1.  Push your code to GitHub.
2.  Go to Settings > Pages.
3.  The included `.github/workflows/deploy.yml` handling the build process will automatically deploy changes from the `master` (or `main`) branch.
4.  Make sure `firebase-config.js` is **not** committed — the deployed site on GitHub Pages will need its own config strategy (see Security section).

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

