# code-vault-desktop

🚀 AI-powered code snippet manager and developer productivity tool

Code Vault Desktop is the companion application for the Code Vault ecosystem. It provides a backend server, database, and UI to manage your personal library of code snippets. The app connects seamlessly with the Code Vault VS Code Extension
 to capture, organize, and suggest relevant code snippets while you code.

✨ Features

📚 Snippet Library – Store and organize snippets by language, tags, and date

🤖 AI Suggestions – Get relevant snippet suggestions while coding in VS Code

🔍 Search & Filter – Quickly find snippets with advanced search

🖥️ Desktop UI – Browse and manage snippets outside VS Code

🔗 Extension Integration – Works with Code Vault VS Code Extension via REST API

☁️ Hosted Backend – Server already deployed on Render

🛠️ Installation
From Releases

Go to the Releases page

Download the latest installer for your OS (.exe <!--,.dmg, or .AppImage-->)

Install and run Code Vault Desktop

The app will connect automatically to the hosted server.

⚙️ Configuration

By default, the desktop app and VS Code extension use the hosted backend:

<https://code-vault-desktop.onrender.com>

If you prefer to run the backend locally (for offline use or development), you can:

## Start backend locally

npm install
npm run dev

Then set the extension serverUrl to:

<http://localhost:8802>

🔌 API Reference

GET /api/health → Check server status

GET /api/snippets → List all snippets

POST /api/snippets → Save new snippet

POST /api/ai/analyze → AI code similarity analysis

🧑‍💻 Development

Frontend: React + Vite

Backend: Node.js + Express / MongoDB (cloud)

Deployment: Electron (desktop app) + Render (backend)

🚀 Roadmap

 Multi-device sync

 Cloud-first storage option

📜 License

MIT License – see LICENSE

💡 Credits

Code Vault is developed and maintained by Ann Studios.
