#!/bin/bash

# Quick Start Script for Python Backend
# This script helps you get the Python backend running quickly

echo "🐍 Compliant4 Python Backend - Quick Start"
echo "=========================================="
echo ""

# Check Python version
echo "📋 Checking Python version..."
python3 --version
if [ $? -ne 0 ]; then
    echo "❌ Python 3 is not installed. Please install Python 3.10 or higher."
    exit 1
fi

echo ""
echo "📦 Creating virtual environment..."
python3 -m venv venv

echo ""
echo "🔧 Activating virtual environment..."
source venv/bin/activate

echo ""
echo "📥 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "📝 Setting up environment file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
else
    echo "ℹ️  .env file already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the server:"
echo "   source venv/bin/activate"
echo "   uvicorn main:app --reload --host 0.0.0.0 --port 3001"
echo ""
echo "📚 API Documentation will be available at:"
echo "   http://localhost:3001/api-docs"
echo ""
