#!/bin/bash

# MCP Memory Server Quick Start Script

echo "🧠 MCP Memory Server Quick Start"
echo "================================"
echo ""

# Check if Ollama is running
echo "Checking Ollama status..."
if curl -s http://localhost:11434 > /dev/null; then
    echo "✅ Ollama is running"
else
    echo "❌ Ollama is not running"
    echo "Please start Ollama first: ollama serve"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    echo "Please install Node.js and npm first"
    exit 1
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build TypeScript
echo ""
echo "Building TypeScript..."
npm run build

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file (edit it to customize settings)"
fi

# Start the server
echo ""
echo "Starting Memory Server..."
echo "========================"
echo ""
echo "Server will run on: http://localhost:8090"
echo "Dashboard available at: file://$(pwd)/examples/dashboard.html"
echo ""
echo "To test with ELVIS, update your ELVIS config:"
echo "  ollamaUrl: 'http://localhost:8090'"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
