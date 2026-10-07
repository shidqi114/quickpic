#!/bin/bash
# QuickPic Hardware Daemon Installation Script for Linux (Ubuntu/Debian)
# This script installs gphoto2, CUPS, Python dependencies, and sets up the daemon

set -e

echo ""
echo "============================================"
echo "QuickPic Hardware Daemon - Linux Setup"
echo "============================================"
echo ""

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
    echo "This script must be run with sudo for system package installation"
    echo ""
    echo "Run: sudo ./install-linux.sh"
    exit 1
fi

# Update package lists
echo "[1/6] Updating package lists..."
apt-get update -qq
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[2/6] Installing Python..."
    apt-get install -y python3 python3-pip python3-venv
else
    echo "[2/6] Python found:"
    python3 --version
fi
echo ""

# Install gphoto2 and related packages
echo "[3/6] Installing gphoto2..."
apt-get install -y gphoto2 libgphoto2-6
echo ""

# Install CUPS and printing utilities
echo "[4/6] Installing CUPS and printing utilities..."
apt-get install -y cups cups-client lpr lpstat usbutils
echo ""

# Set up user permissions for USB devices
REAL_USER=${SUDO_USER:-$(whoami)}
if [ "$REAL_USER" != "root" ]; then
    echo "[5/6] Setting up USB device permissions for user: $REAL_USER"
    usermod -a -G dialout,plugdev "$REAL_USER"
    echo "User added to dialout and plugdev groups"
    echo "Note: User must log out and log back in for group changes to take effect"
else
    echo "[5/6] Running as root - skipping user permission setup"
fi
echo ""

# Install Python dependencies
echo "[6/6] Installing Python dependencies..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
echo ""

# Create startup script
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
echo "IMPORTANT: Please read the following:"
echo ""
echo "1. USB Device Permissions:"
echo "   You have been added to the 'dialout' and 'plugdev' groups"
echo "   You must LOG OUT and LOG BACK IN for this to take effect!"
echo ""
echo "2. Next Steps:"
echo "   a) Log out and log back in"
echo "   b) Connect your Canon camera via USB-C"
echo "   c) Connect your DNP printer via USB"
echo "   d) Run the daemon: ./start-daemon.sh"
echo ""
echo "3. Test the connection:"
echo "   gphoto2 --auto-detect"
echo "   lpstat -p"
echo ""
echo "4. Access the API at: http://localhost:8000"
echo "5. Diagnostics at: http://localhost:8000/debug/usb"
echo ""
echo "6. Optional: Add printer to CUPS"
echo "   lsusb           # Find your DNP printer USB ID"
echo "   sudo lpadmin -p DNP_PRINTER -v usb://DEVICE_ID -E -m everywhere"
echo ""
