# QuickPic Local Hardware Companion Daemon

Controls Canon DSLR/Mirrorless cameras and monitors DNP Dye-Sublimation printers (DS-RX1, DS620, Citizen).

## Features
- **Canon EDSDK / gphoto2 Bridge**: Control ISO, Shutter Speed, and White Balance.
- **Dual Exposure Profile**: Separate high-gain ISO for live preview and strobe sync (ISO 100, 1/125s) for flash capture.
- **DNP Spooler & Ribbon Meter**: Monitors remaining print media count (e.g. 700 cuts) and provides a shared network print queue for multi-kiosk setups.
- **Heartbeat & Telemetry**: Reports CPU, RAM, Camera, Printer, and Network status to the Admin Dashboard.

## Installation

### Automated Installation (Recommended)

Choose your platform and run the installer script:

**Linux (Ubuntu/Debian):**
```bash
cd hardware-daemon
sudo ./install-linux.sh
./start-daemon.sh
```

**macOS:**
```bash
cd hardware-daemon
chmod +x install-macos.sh
./install-macos.sh
./start-daemon.sh
```

**Windows:**
```cmd
cd hardware-daemon
install-windows.bat
start-daemon.bat
```

### Manual Installation

If you prefer manual setup:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y gphoto2 cups cups-client lpr usbutils
sudo usermod -a -G dialout,plugdev $USER

# macOS
brew install gphoto2
# CUPS is pre-installed on macOS

# Windows
# Download and install from: https://sourceforge.net/projects/gphoto/files/

# Then install Python dependencies
pip install -r requirements.txt
python app.py
```

## Quick Start
```bash
cd hardware-daemon
./start-daemon.sh  # macOS/Linux
# or
start-daemon.bat   # Windows
```
Runs at `http://localhost:8000`.

## Troubleshooting Hardware Detection

### Camera Not Detected (USB-C Canon)

1. **Check USB Connection**:
   ```bash
   lsusb | grep Canon  # Linux/Raspberry Pi
   system_profiler SPUSBDataType | grep Canon  # macOS
   ```

2. **Enable gphoto2 Detection**:
   ```bash
   gphoto2 --auto-detect
   ```
   If this shows your camera, it's properly configured.

3. **Permission Issues** (Linux):
   ```bash
   # Add current user to dialout/plugdev groups
   sudo usermod -a -G dialout,plugdev $USER
   # Log out and log back in for changes to take effect
   ```

4. **Diagnostic Endpoint**:
   ```bash
   curl http://localhost:8000/debug/usb
   # Returns: available tools, USB devices, and camera/printer status
   ```

### Printer Not Detected (USB DNP)

1. **Check USB Connection**:
   ```bash
   lsusb | grep -i dnp  # Linux
   system_profiler SPUSBDataType | grep -i dnp  # macOS
   ```

2. **CUPS Printer Configuration**:
   ```bash
   lpstat -p  # List configured printers
   lpstat -p -d  # Show default printer
   ```

3. **Add Printer to CUPS** (Linux):
   ```bash
   sudo lpadmin -p DNP_DS_RX1HS -v usb://DEVICE_ID -E -m everywhere
   # Replace DEVICE_ID from lsusb output
   ```

4. **Test Print**:
   ```bash
   echo "test" | lpr -P DNP_DS_RX1HS
   ```

5. **Restart CUPS**:
   ```bash
   sudo systemctl restart cups  # Linux
   # or brew services restart cups  # macOS
   ```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/camera/status` | GET | Camera connection status & config profiles |
| `/camera/stream` | GET | Live MJPEG preview stream |
| `/camera/preview` | GET | Single JPEG frame from live preview |
| `/camera/capture` | POST | Trigger flash capture & download image |
| `/printer/status` | GET | Printer connection & ribbon status |
| `/printer/print` | POST | Enqueue print job |
| `/device/telemetry` | GET | System health (CPU, RAM, disk, hardware status) |
| `/debug/usb` | GET | USB device diagnostics & tool availability |
