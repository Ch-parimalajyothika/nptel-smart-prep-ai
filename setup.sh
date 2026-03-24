#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# NPTEL Smart Prep AI — One-command setup script (Mac/Linux)
# Usage: chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────

set -e  # Exit on any error

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     NPTEL Smart Prep AI — Setup          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check Node.js ─────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install from https://nodejs.org${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version) found${NC}"

# ── Check Python ──────────────────────────────────────
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python3 not found. Please install from https://python.org${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python $(python3 --version) found${NC}"

# ── Backend Setup ─────────────────────────────────────
echo ""
echo -e "${CYAN}📦 Setting up Backend...${NC}"
cd backend

# Create .env from example if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠  Created backend/.env — Please add your API keys!${NC}"
fi

# Create virtual environment
if [ ! -d venv ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate and install
source venv/bin/activate
echo "Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
deactivate
cd ..

# ── Frontend Setup ────────────────────────────────────
echo ""
echo -e "${CYAN}📦 Setting up Frontend...${NC}"
cd frontend
echo "Installing Node dependencies (this may take 1-2 minutes)..."
npm install --silent
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
cd ..

# ── Done ──────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✅ Setup Complete!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Add your API keys to backend/.env:"
echo "     ${CYAN}nano backend/.env${NC}"
echo "     → Set GEMINI_API_KEY=your_key_here"
echo "     → Set OPENAI_API_KEY=your_key_here (for audio)"
echo ""
echo "  2. Start the backend (Terminal 1):"
echo "     ${CYAN}cd backend && source venv/bin/activate && python app.py${NC}"
echo ""
echo "  3. Start the frontend (Terminal 2):"
echo "     ${CYAN}cd frontend && npm start${NC}"
echo ""
echo "  4. Open your browser:"
echo "     ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}🎓 Happy studying!${NC}"
echo ""
