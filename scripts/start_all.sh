#!/usr/bin/env bash
# ==============================================================================
# 🌍 DashTiny — Unified Local Development Runner
# Starts PostgreSQL DB, FastAPI Backend, and Next.js Frontend together.
# Handles automatic migrations, seeding, health checks, and graceful shutdown.
# ==============================================================================

set -eo pipefail

# ANSI Colors
BOLD='\033[1m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
VENV_DIR="${BACKEND_DIR}/venv"
PYTHON_BIN="${VENV_DIR}/bin/python"

# Track background process PIDs
BACKEND_PID=""
FRONTEND_PID=""

# ------------------------------------------------------------------------------
# Banner
# ------------------------------------------------------------------------------
echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    🌍 DashTiny Local Platform                    ║"
echo "║          Intelligent Travel Discovery, Planning & Squads         ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ------------------------------------------------------------------------------
# Cleanup handler for graceful shutdown
# ------------------------------------------------------------------------------
cleanup() {
    echo ""
    echo -e "${YELLOW}[SYSTEM] Shutting down DashTiny services cleanly...${NC}"

    if [ -n "${BACKEND_PID}" ] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
        echo -e "${CYAN}[BACKEND] Stopping FastAPI server (PID: ${BACKEND_PID})...${NC}"
        kill -TERM "${BACKEND_PID}" 2>/dev/null || true
    fi

    if [ -n "${FRONTEND_PID}" ] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
        echo -e "${MAGENTA}[FRONTEND] Stopping Next.js server (PID: ${FRONTEND_PID})...${NC}"
        kill -TERM "${FRONTEND_PID}" 2>/dev/null || true
    fi

    # Wait for processes to exit
    wait 2>/dev/null || true

    # Final check on ports 8000 and 3000 to prevent zombie processes
    local stale_pids
    stale_pids=$(lsof -ti :8000 -ti :3000 2>/dev/null || true)
    if [ -n "${stale_pids}" ]; then
        echo -e "${YELLOW}[SYSTEM] Releasing reserved ports (PIDs: ${stale_pids})...${NC}"
        kill -9 ${stale_pids} 2>/dev/null || true
    fi

    echo -e "${GREEN}[SYSTEM] DashTiny services stopped safely. Bye! 👋${NC}"
}
trap cleanup SIGINT SIGTERM EXIT

# ------------------------------------------------------------------------------
# Port conflict check
# ------------------------------------------------------------------------------
check_and_free_port() {
    local port=$1
    local name=$2
    local pid
    pid=$(lsof -ti :${port} 2>/dev/null || true)
    if [ -n "${pid}" ]; then
        echo -e "${YELLOW}[SYSTEM] Port ${port} is occupied by PID(s): ${pid}. Freeing for ${name}...${NC}"
        kill -9 ${pid} 2>/dev/null || true
        sleep 1
    fi
}

check_and_free_port 8000 "FastAPI Backend"
check_and_free_port 3000 "Next.js Frontend"

# ------------------------------------------------------------------------------
# 1. Database (PostgreSQL) Verification & Start
# ------------------------------------------------------------------------------
echo -e "${GREEN}[DB] Checking PostgreSQL connection on localhost:5432...${NC}"

is_pg_ready() {
    if command -v pg_isready >/dev/null 2>&1; then
        pg_isready -h localhost -p 5432 >/dev/null 2>&1
    else
        "${PYTHON_BIN:-python3}" -c '
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1)
try:
    s.connect(("localhost", 5432))
    s.close()
    exit(0)
except Exception:
    exit(1)
' 2>/dev/null
    fi
}

if ! is_pg_ready; then
    echo -e "${YELLOW}[DB] PostgreSQL is not accepting connections. Attempting to start...${NC}"
    
    # Try brew service on macOS
    if command -v brew >/dev/null 2>&1; then
        for formula in postgresql@14 postgresql@16 postgresql@15 postgresql; do
            if brew list --versions "${formula}" >/dev/null 2>&1; then
                echo -e "${CYAN}[DB] Starting Homebrew service '${formula}'...${NC}"
                brew services start "${formula}" >/dev/null 2>&1 || true
                break
            fi
        done
    # Try Docker compose if docker daemon is running
    elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        echo -e "${CYAN}[DB] Starting PostgreSQL via Docker Compose...${NC}"
        (cd "${BACKEND_DIR}" && docker compose up -d postgres >/dev/null 2>&1 || true)
    fi

    # Wait for PostgreSQL to become ready (up to 12s)
    for i in {1..12}; do
        if is_pg_ready; then
            break
        fi
        sleep 1
    done
fi

if ! is_pg_ready; then
    echo -e "${RED}[DB] Error: Unable to connect to PostgreSQL on port 5432.${NC}"
    echo -e "${YELLOW}Please ensure PostgreSQL is running (e.g. 'brew services start postgresql@14' or start Postgres.app/Docker).${NC}"
    exit 1
fi
echo -e "${GREEN}[DB] ✅ PostgreSQL is running and accepting connections on port 5432.${NC}"

# Ensure python environment exists
if [ ! -f "${PYTHON_BIN}" ]; then
    echo -e "${YELLOW}[SYSTEM] Creating Python virtual environment in backend/venv...${NC}"
    python3 -m venv "${VENV_DIR}"
    "${VENV_DIR}/bin/pip" install --upgrade pip
    "${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
fi

# Ensure database 'dashtiny_db' exists
echo -e "${GREEN}[DB] Verifying database 'dashtiny_db' exists...${NC}"
"${PYTHON_BIN}" -c '
from sqlalchemy import create_engine, text
url_default = "postgresql://postgres:postgres@localhost:5432/postgres"
try:
    engine = create_engine(url_default, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname=\x27dashtiny_db\x27")).scalar()
        if not exists:
            conn.execute(text("CREATE DATABASE dashtiny_db"))
            print("Created database dashtiny_db successfully.")
except Exception as e:
    pass
' || true

# Run Alembic migrations and database seeding
echo -e "${GREEN}[DB] Applying Alembic migrations and seeding baseline datasets...${NC}"
(cd "${BACKEND_DIR}" && "${PYTHON_BIN}" init_db.py)

# ------------------------------------------------------------------------------
# 2. FastAPI Backend Start
# ------------------------------------------------------------------------------
echo -e "${CYAN}[BACKEND] Starting FastAPI Backend on http://localhost:8000...${NC}"
(
    cd "${BACKEND_DIR}"
    exec "${PYTHON_BIN}" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) 2>&1 | sed -e "s/^/$(printf "${CYAN}[BACKEND]${NC} ")/" &
BACKEND_PID=$!

# Wait for backend healthcheck (up to 15s)
echo -e "${CYAN}[BACKEND] Waiting for API to be healthy...${NC}"
for i in {1..15}; do
    if curl -s http://127.0.0.1:8000/health | grep -q "status"; then
        echo -e "${CYAN}[BACKEND] ✅ FastAPI is healthy and listening on http://localhost:8000${NC}"
        break
    fi
    sleep 1
done

# ------------------------------------------------------------------------------
# 3. Next.js Frontend Start
# ------------------------------------------------------------------------------
if [ ! -d "${ROOT_DIR}/node_modules" ]; then
    echo -e "${YELLOW}[FRONTEND] node_modules missing. Installing npm packages...${NC}"
    (cd "${ROOT_DIR}" && npm install)
fi

echo -e "${MAGENTA}[FRONTEND] Starting Next.js Frontend on http://localhost:3000...${NC}"
(
    cd "${ROOT_DIR}"
    exec npm run dev
) 2>&1 | sed -e "s/^/$(printf "${MAGENTA}[FRONTEND]${NC} ")/" &
FRONTEND_PID=$!

# Wait for frontend port 3000
for i in {1..15}; do
    if lsof -ti :3000 >/dev/null 2>&1; then
        echo -e "${MAGENTA}[FRONTEND] ✅ Next.js is listening on http://localhost:3000${NC}"
        break
    fi
    sleep 1
done

# ------------------------------------------------------------------------------
# Ready Summary
# ------------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo -e "${GREEN}${BOLD}🚀 All DashTiny Services Are Live!${NC}"
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo -e "  🌐 ${BOLD}Frontend App:${NC}       http://localhost:3000"
echo -e "  ⚡ ${BOLD}FastAPI Backend:${NC}    http://localhost:8000"
echo -e "  📚 ${BOLD}Interactive Docs:${NC}   http://localhost:8000/docs"
echo -e "  🗄️  ${BOLD}Database:${NC}           PostgreSQL (localhost:5432/dashtiny_db)"
echo -e "  🩺 ${BOLD}API Health:${NC}         http://localhost:8000/health"
echo -e "${GREEN}${BOLD}==================================================================${NC}"
echo -e "${YELLOW}Press Ctrl+C at any time to safely stop all services.${NC}"
echo ""

# Keep running until Ctrl+C
wait "${BACKEND_PID}" "${FRONTEND_PID}"
