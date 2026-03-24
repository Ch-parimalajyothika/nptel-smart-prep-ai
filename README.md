# 🎓 NPTEL Smart Prep AI

> Your intelligent AI-powered companion for NPTEL exam preparation.  
> Built with React + Tailwind CSS (frontend) · Flask + SQLite (backend) · Google Gemini (AI) · Whisper (Speech-to-text)

---

## 📁 Project Structure

```
nptel-smart-prep-ai/
├── frontend/                    ← React application
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Signup.jsx
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Header.jsx
│   │   │   ├── Dashboard/
│   │   │   │   └── Dashboard.jsx
│   │   │   ├── Notes/
│   │   │   │   └── Notes.jsx
│   │   │   ├── Questions/
│   │   │   │   └── Questions.jsx
│   │   │   ├── Exam/
│   │   │   │   └── Exam.jsx
│   │   │   ├── Upload/
│   │   │   │   └── Upload.jsx
│   │   │   ├── Chatbot/
│   │   │   │   └── Chatbot.jsx
│   │   │   └── Progress/
│   │   │       └── Progress.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── backend/                     ← Flask application
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── notes.py
│   │   ├── questions.py
│   │   ├── upload.py
│   │   ├── chat.py
│   │   └── progress.py
│   ├── utils/
│   │   ├── __init__.py
│   │   └── gemini.py
│   ├── app.py
│   ├── database.py
│   ├── requirements.txt
│   └── .env.example
│
├── README.md
├── setup.sh                     ← One-command setup (macOS/Linux)
└── setup.bat                    ← One-command setup (Windows)
```

---

## 🚀 Quick Start

### Prerequisites

| Tool    | Version | Download |
|---------|---------|----------|
| Node.js | ≥ 18    | https://nodejs.org |
| Python  | ≥ 3.9   | https://python.org |
| pip     | latest  | bundled with Python |

---

## ⚙️ Step-by-Step Setup

### Step 1 — Get API Keys

#### Google Gemini (Required for AI features)
1. Go to https://makersuite.google.com/app/apikey
2. Click **"Create API Key"**
3. Copy your key

#### OpenAI Whisper (Required for audio transcription)
1. Go to https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Copy your key
> **Note**: Whisper charges ~$0.006/minute of audio. A 1-hour lecture ≈ $0.36

---

### Step 2 — Setup Backend

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv

# 3. Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create your .env file
cp .env.example .env

# 6. Edit .env and add your API keys
# Open .env in any text editor:
nano .env          # Linux/Mac
notepad .env       # Windows

# Add:
# GEMINI_API_KEY=your_actual_gemini_key_here
# OPENAI_API_KEY=your_actual_openai_key_here
# SECRET_KEY=any-random-string-here-change-me

# 7. Start the backend server
python app.py
```

You should see:
```
✅  Database tables initialised.
✅  NPTEL Smart Prep AI backend running on http://localhost:5000
```

---

### Step 3 — Setup Frontend

Open a **new terminal window**:

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies (first time only — takes ~2 min)
npm install

# 3. Start the development server
npm start
```

The browser will automatically open http://localhost:3000

---

### Step 4 — Login

1. Open http://localhost:3000
2. Click **"Try Demo Account"** for instant access, OR
3. Click **"Create one"** to register your own account

---

## 🔑 API Keys — Where to Get Them

### Gemini API (Free tier available)
```
1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key in new project"
4. Copy the key → paste in backend/.env as GEMINI_API_KEY
```

### OpenAI Whisper (Pay per use)
```
1. Visit: https://platform.openai.com/api-keys
2. Create account (add $5 credit minimum)
3. Create API key → paste in backend/.env as OPENAI_API_KEY
```

> 💡 **Running without API keys?** The app works in **Demo Mode** — all features show pre-built sample content. Just click "Try Demo Account" on the login page.

---

## 🌟 Features Overview

| Feature | Description |
|---------|-------------|
| 🔐 **Auth** | JWT-based login/signup with bcrypt password hashing |
| 📊 **Dashboard** | Course cards, quick actions, stats overview |
| 📝 **Notes Generator** | Summary / Detailed / Key Points per week |
| ❓ **Question Generator** | MCQ / Short / Long / Exam-focused questions |
| 🏆 **Exam Mode** | Timed quiz, score calculation, answer review |
| 📤 **Upload** | PDF text extraction, audio/video transcription |
| 🤖 **AI Chatbot** | Context-aware answers using uploaded materials |
| 📈 **Progress Tracker** | Radar chart, weekly scores, weak areas |
| 🌙 **Dark Mode** | Full dark/light theme toggle |
| 📱 **Responsive** | Works on mobile, tablet, and desktop |

---

## 🔌 API Endpoints Reference

### Authentication
```
POST /api/auth/signup    { name, email, password }
POST /api/auth/login     { email, password }
GET  /api/auth/me        (requires JWT)
```

### Notes
```
POST /api/notes/generate  { course, week, type, topic? }
GET  /api/notes/
GET  /api/notes/<id>
DELETE /api/notes/<id>
```

### Questions
```
POST /api/questions/generate  { course, week?, type, count, topic? }
GET  /api/questions/
GET  /api/questions/<id>
```

### Upload
```
POST /api/upload/pdf        multipart/form-data { file }
POST /api/upload/audio      multipart/form-data { file }
POST /api/upload/video-url  { url }
GET  /api/upload/
DELETE /api/upload/<id>
```

### Chat
```
POST   /api/chat/message  { message, history[], context_ids[]? }
GET    /api/chat/history
DELETE /api/chat/history
```

### Progress
```
GET    /api/progress/
POST   /api/progress/update  { course, week, topic, completed, score? }
DELETE /api/progress/
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18** — Component-based UI
- **React Router v6** — Client-side routing
- **Tailwind CSS 3** — Utility-first styling
- **Axios** — HTTP client with interceptors
- **React Markdown** — Render AI-generated Markdown
- **Recharts** — Progress charts (Radar + Bar)
- **React Dropzone** — File upload UI
- **React Hot Toast** — Toast notifications
- **Lucide React** — Icon library

### Backend
- **Flask 3** — Python web framework
- **Flask-JWT-Extended** — JWT authentication
- **Flask-CORS** — Cross-origin requests
- **SQLite** — Lightweight database (no server needed)
- **bcrypt** — Password hashing
- **pdfplumber** — PDF text extraction
- **google-generativeai** — Gemini AI SDK
- **openai** — Whisper speech-to-text
- **yt-dlp** — Video audio extraction

---

## 🎨 UI Design Highlights

- **Color Palette**: Brand teal (#14b896) with slate neutrals
- **Typography**: Syne (display) + Plus Jakarta Sans (body) + JetBrains Mono (code)
- **Dark Mode**: Full dark theme via CSS variables
- **Animations**: Fade-in, slide-up, typing indicator
- **Responsive**: Mobile-first with lg: breakpoints for desktop

---

## 🐛 Troubleshooting

### "Module not found" errors (Frontend)
```bash
cd frontend && npm install
```

### "pip install" failures
```bash
# Upgrade pip first
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### "GEMINI_API_KEY not set" error
```bash
# Make sure your .env file exists and has the key:
cat backend/.env  # Linux/Mac
type backend\.env  # Windows
```

### Port already in use
```bash
# Kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill  # Mac/Linux
netstat -ano | findstr :5000  # Windows (then taskkill /PID <pid>)
```

### CORS errors in browser
Make sure both servers are running:
- Backend: http://localhost:5000
- Frontend: http://localhost:3000

---

## 📦 Build for Production

```bash
# Frontend build
cd frontend
npm run build
# Output in frontend/build/

# Serve backend with gunicorn (production)
cd backend
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

**Made with ❤️ for NPTEL students**
