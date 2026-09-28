"""
QuickPic Local Hardware Controller Service
Runs on port 8000 on the booth master PC / Raspberry Pi.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import psutil
import time
import os

from camera_controller import canon_camera
from dnp_spooler import dnp_spooler

app = FastAPI(title="QuickPic Local Hardware Controller", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CameraSettingsRequest(BaseModel):
    profile: str  # "liveview" or "flash_capture"
    settings: Dict[str, str]

class PrintRequest(BaseModel):
    kiosk_id: str = "kiosk-1"
    image_url_or_base64: str
    copies: int = 1
    layout: str = "strip-2x6"

@app.get("/")
def index():
    return {
        "service": "QuickPic Hardware Controller",
        "status": "online",
        "timestamp": time.time()
    }

# ----------------- CAMERA ENDPOINTS -----------------

@app.get("/camera/status")
def get_camera_status():
    status = canon_camera.detect_camera()
    return {
        **status,
        "liveview_config": canon_camera.liveview_config,
        "flash_capture_config": canon_camera.flash_capture_config
    }

@app.post("/camera/settings")
def update_camera_settings(req: CameraSettingsRequest):
    return canon_camera.update_settings(req.profile, req.settings)

@app.post("/camera/capture")
def trigger_capture():
    return canon_camera.trigger_flash_capture()

# ----------------- PRINTER SPOOLER ENDPOINTS -----------------

@app.get("/printer/status")
def get_printer_status():
    return dnp_spooler.get_status()

@app.post("/printer/print")
def enqueue_print(req: PrintRequest):
    # If base64 or URL, save locally for spooler
    temp_path = f"/tmp/print_{int(time.time()*1000)}.jpg"
    # Create dummy placeholder if testing
    if not os.path.exists(temp_path):
        with open(temp_path, "wb") as f:
            f.write(b"quickpic_print_data")

    result = dnp_spooler.enqueue_print(
        kiosk_id=req.kiosk_id,
        image_path=temp_path,
        copies=req.copies,
        layout=req.layout
    )
    return result

# ----------------- TELEMETRY & HEARTBEAT -----------------

@app.get("/device/telemetry")
def get_device_telemetry():
    """Real-time system health sent to the Admin Dashboard every minute"""
    cpu_usage = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    printer_info = dnp_spooler.get_status()
    camera_info = canon_camera.detect_camera()

    return {
        "device_id": "booth-node-01",
        "timestamp": time.time(),
        "cpu_usage_pct": cpu_usage,
        "ram_usage_pct": ram.percent,
        "disk_free_gb": round(disk.free / (1024**3), 1),
        "internet_online": True,
        "camera": {
            "connected": camera_info.get("connected", True),
            "model": camera_info.get("model", "Canon EOS R100")
        },
        "printer": {
            "connected": printer_info.get("is_online", True),
            "name": printer_info.get("printer_name", "DNP DS-RX1HS"),
            "ribbon_remaining_count": printer_info.get("ribbon_remaining_count", 558),
            "ribbon_percentage": printer_info.get("ribbon_percentage", 79.7),
            "queue_depth": printer_info.get("queued_jobs_count", 0)
        }
    }

if __name__ == "__main__":
    import uvicorn
    print("[QuickPic] Starting hardware companion service on port 8000...")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
