#!/bin/bash
# QuickPic Hardware Daemon Installation Script for macOS
# This script installs gphoto2, Python dependencies, and sets up the daemon

set -e

echo ""
echo "============================================"
echo "QuickPic Hardware Daemon - macOS Setup"
echo "============================================"
echo ""

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "ERROR: Homebrew is not installed"
    echo "Install Homebrew from https://brew.sh"
    echo ""
    echo "/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

echo "[1/5] Homebrew found:"
brew --version
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[2/5] Python not found. Installing via Homebrew..."
    brew install python@3.11
else
    echo "[2/5] Python found:"
    python3 --version
fi
echo ""

# Install gphoto2
if ! command -v gphoto2 &> /dev/null; then
    echo "[3/5] Installing gphoto2..."
    brew install gphoto2
else
    echo "[3/5] gphoto2 found:"
    gphoto2 --version | head -1
fi
echo ""

# Install Python dependencies
echo "[4/5] Installing Python dependencies..."
python3 -m pip install -r requirements.txt
echo ""

# Create startup script
echo "[5/5] Creating startup script..."
cat > start-daemon.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
python3 app.py
EOF
chmod +x start-daemon.sh
echo "Created start-daemon.sh"
echo ""

# Success message
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Next Steps:"
echo ""
echo "1. Connect your Canon camera via USB-C"
echo "2. Connect your DNP printer via USB"
echo "3. Run the daemon:"
echo "   ./start-daemon.sh"
echo ""
echo "4. Test the connection in another terminal:"
echo "   gphoto2 --auto-detect"
echo "   lpstat -p"
echo ""
echo "5. Access the API at: http://localhost:8000"
echo "6. Diagnostics at: http://localhost:8000/debug/usb"
echo ""
