#!/bin/bash
set -e

echo "🚀 Setting up NirnayDAG Local Environment..."

# 1. Check Node version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node >= 18."
    exit 1
fi
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher."
    exit 1
fi

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Build CLI and Web App
echo "🛠️ Compiling CLI & Visualizer..."
npm run build

# 4. Scaffold starter ADRs if empty
if [ ! -d "./adrs" ] || [ -z "$(ls -A ./adrs 2>/dev/null)" ]; then
    echo "📁 Scaffolding starter ADRs..."
    npx ndag init
else
    echo "✅ ADR directory already exists."
fi

# 5. Launch local visualizer
echo "✨ Setup complete! Launching visualizer server..."
echo "🌐 URL: http://localhost:5173"
npm run dev
