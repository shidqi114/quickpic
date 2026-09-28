# QuickPic Local Hardware Companion Daemon

Controls Canon DSLR/Mirrorless cameras and monitors DNP Dye-Sublimation printers (DS-RX1, DS620, Citizen).

## Features
- **Canon EDSDK / gphoto2 Bridge**: Control ISO, Shutter Speed, and White Balance.
- **Dual Exposure Profile**: Separate high-gain ISO for live preview and strobe sync (ISO 100, 1/125s) for flash capture.
- **DNP Spooler & Ribbon Meter**: Monitors remaining print media count (e.g. 700 cuts) and provides a shared network print queue for multi-kiosk setups.
- **Heartbeat & Telemetry**: Reports CPU, RAM, Camera, Printer, and Network status to the Admin Dashboard.

## Quick Start
```bash
cd hardware-daemon
pip install -r requirements.txt
python app.py
```
Runs at `http://localhost:8000`.
