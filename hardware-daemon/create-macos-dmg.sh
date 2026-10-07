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

# Create DMG installer
echo "[3/4] Creating DMG installer..."
DMG_OUTPUT="QuickPic-Hardware-Daemon-Installer.dmg"
rm -f "$DMG_OUTPUT"

# Add Applications symlink inside the bundle directory for easy drag-and-drop
ln -s /Applications "$TEMP_DIR/Applications" 2>/dev/null || true

if command -v create-dmg &> /dev/null; then
    echo "Using create-dmg utility..."
    create-dmg \
        --volname "QuickPic Hardware Daemon" \
        --window-pos 200 120 \
        --window-size 600 400 \
        --icon-size 100 \
        --icon "QuickPic Hardware Daemon.app" 150 190 \
        --hide-extension "QuickPic Hardware Daemon.app" \
        --app-drop-link 450 190 \
        "$DMG_OUTPUT" \
        "$TEMP_DIR" || {
            echo "create-dmg had non-fatal warning, ensuring DMG exists via hdiutil..."
            [ -f "$DMG_OUTPUT" ] || hdiutil create -volname "QuickPic Hardware Daemon" -srcfolder "$TEMP_DIR" -ov -format UDZO "$DMG_OUTPUT"
        }
else
    echo "create-dmg not found, creating DMG with native hdiutil..."
    hdiutil create -volname "QuickPic Hardware Daemon" -srcfolder "$TEMP_DIR" -ov -format UDZO "$DMG_OUTPUT"
fi

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
