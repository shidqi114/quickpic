#!/bin/bash
# QuickPic Hardware Daemon - macOS DMG Installer Creator
# This script creates a professional .dmg installer for macOS
# Usage: ./create-macos-dmg.sh

set -e

echo "Creating QuickPic Hardware Daemon macOS Installer..."
echo ""

# Check if create-dmg is installed
if ! command -v create-dmg &> /dev/null; then
    echo "Installing create-dmg utility..."
    brew install create-dmg
fi

# Create temporary directory structure
TEMP_DIR=$(mktemp -d)
APP_DIR="$TEMP_DIR/QuickPic Hardware Daemon.app/Contents/MacOS"
RESOURCES_DIR="$TEMP_DIR/QuickPic Hardware Daemon.app/Contents/Resources"

echo "[1/4] Creating app bundle structure..."
mkdir -p "$APP_DIR"
mkdir -p "$RESOURCES_DIR"

# Copy daemon files
echo "[2/4] Copying application files..."
cp app.py "$APP_DIR/"
cp camera_controller.py "$APP_DIR/"
cp dnp_spooler.py "$APP_DIR/"
cp requirements.txt "$APP_DIR/"
cp README.md "$RESOURCES_DIR/"

# Create the launcher script
cat > "$APP_DIR/QuickPic-Hardware-Daemon" << 'EOF'
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    osascript -e 'tell app "System Events" to display dialog "Python 3 is required but not installed.\n\nPlease install Python 3 from python.org or via Homebrew:\nbrew install python@3.11" buttons {"OK"}'
    exit 1
fi

# Install dependencies if needed
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Run the daemon
python3 app.py
EOF
chmod +x "$APP_DIR/QuickPic-Hardware-Daemon"

# Create Info.plist
cat > "$TEMP_DIR/QuickPic Hardware Daemon.app/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>QuickPic-Hardware-Daemon</string>
    <key>CFBundleIdentifier</key>
    <string>com.quickpic.hardware-daemon</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>QuickPic Hardware Daemon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

# Create background image for DMG
echo "[3/4] Creating DMG installer..."
mkdir -p "$TEMP_DIR/.background"
cat > "$TEMP_DIR/.background/background.txt" << 'EOF'
This is the QuickPic Hardware Daemon installer.

To install:
1. Drag "QuickPic Hardware Daemon.app" to Applications folder
2. Double-click the app to launch
3. Follow the on-screen instructions
EOF

# Create the DMG using create-dmg
create-dmg \
    --volname "QuickPic Hardware Daemon" \
    --icon "QuickPic Hardware Daemon.app" 100 100 \
    --hide-extension "QuickPic Hardware Daemon.app" \
    --window-pos 200 120 \
    --window-size 600 400 \
    --text-size 12 \
    --background "$TEMP_DIR/.background/background.txt" \
    "QuickPic-Hardware-Daemon-Installer.dmg" \
    "$TEMP_DIR"

echo "[4/4] Cleaning up..."
rm -rf "$TEMP_DIR"

echo ""
echo "============================================"
echo "DMG Installer Created Successfully!"
echo "============================================"
echo ""
echo "File: QuickPic-Hardware-Daemon-Installer.dmg"
echo ""
echo "Distribution Instructions:"
echo "1. Share the .dmg file with users"
echo "2. Users double-click to open"
echo "3. Drag app to Applications folder"
echo "4. Launch from Applications"
echo ""
