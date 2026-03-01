#!/bin/bash
set -e

echo "🚀 Agentic Shell 2.0 - Development Setup"
echo "========================================"

# Check prerequisites
echo "🔍 Checking prerequisites..."
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker required"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose required"; exit 1; }

PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
if [[ "$PY_VERSION" < "3.11" ]]; then
    echo "❌ Python 3.11+ required (found $PY_VERSION)"
    exit 1
fi
echo "✅ Prerequisites checked"

# Create virtual environment
echo "🐍 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip poetry
poetry install

# Copy environment file if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
fi

# Create necessary directories
mkdir -p logs data/postgres

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your configuration"
echo "  2. Start services: docker-compose up -d"
echo "  3. Run orchestrator: poetry run python -m src.orchestrator.main"
echo "  4. Connect client: poetry run python -m src.client.cli"
