#!/bin/bash

# Capacitor iOS Setup Script
# Automates the initial setup for iOS development

set -e

echo "🍎 Pastel Chat iOS Setup"
echo "========================="

# Check for required tools
check_tool() {
  if ! command -v $1 &> /dev/null; then
    echo "❌ $1 not found. Please install it and try again."
    exit 1
  fi
  echo "✓ $1 found"
}

echo ""
echo "Checking prerequisites..."
check_tool "node"
check_tool "npm"
check_tool "pod"

# Get Node version
NODE_VERSION=$(node -v)
echo "✓ Node $NODE_VERSION"

echo ""
echo "Installing npm dependencies..."
cd frontend
npm install

echo ""
echo "Building web app..."
npm run build

echo ""
echo "Adding iOS platform..."
npx cap add ios

echo ""
echo "Syncing to iOS..."
npx cap sync ios

echo ""
echo "✅ iOS setup complete!"
echo ""
echo "Next steps:"
echo "1. Download GoogleService-Info.plist from Firebase"
echo "2. Add it to Xcode: App/App/GoogleService-Info.plist"
echo "3. Enable Push Notifications capability in Xcode"
echo "4. Configure APNs certificate in Firebase"
echo "5. Run: npm run cap:open:ios"
echo ""
echo "For detailed setup instructions, see: CAPACITOR_SETUP.md"
