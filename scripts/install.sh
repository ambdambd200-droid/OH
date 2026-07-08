#!/bin/bash
# OH Installer for Linux/macOS
echo "Installing OH (Open Hermes)..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Install from: https://nodejs.org"
    exit 1
fi
echo "✓ Node.js detected: $(node --version)"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build
echo "Building..."
npm run build

# Add to PATH
OH_PATH=$(pwd)
if [[ ":$PATH:" != *":$OH_PATH:"* ]]; then
    echo "export PATH=\"\$PATH:$OH_PATH\"" >> ~/.bashrc
    echo "✓ Added to PATH (restart terminal or 'source ~/.bashrc')"
fi

echo ""
echo "✓ OH installed successfully!"
echo "Run 'npm run oh' to start"
