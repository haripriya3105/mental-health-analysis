# AI-Powered Mental Health Analysis

Starter structure for a web application with an independent React frontend, FastAPI backend, and a reserved machine-learning workspace.

## Prerequisites

- Node.js 18 or newer
- Python 3.10 or newer

## Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Run the backend

In a separate PowerShell window:

```powershell
cd backend
Copy-Item .env.example .env
# Edit .env and replace JWT_SECRET with a long, random value.
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` to view the API documentation, or visit `http://127.0.0.1:8000/health` to verify the health endpoint.

## Current scope

SQLite authentication is now available under `/api/auth`. AI/ML functionality is intentionally not implemented yet.
