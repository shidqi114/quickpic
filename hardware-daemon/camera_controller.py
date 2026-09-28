"""
Canon DSLR / Mirrorless Camera Controller (EDSDK / gphoto2 wrapper)
Supports setting ISO, Shutter Speed, and White Balance with
separate profile configurations for Live Preview vs. Flash Capture.
"""

import subprocess
import shutil
import time
import os
from typing import Dict, Any, Optional

class CanonCameraController:
    def __init__(self):
        self.is_connected = False
        self.camera_model = "Simulated / Canon EOS R100"
        self.use_gphoto = shutil.which("gphoto2") is not None

        # Camera Configuration Profiles
        self.liveview_config = {
            "iso": "1600",
            "shutter_speed": "1/60",
            "white_balance": "Auto",
            "aperture": "f/4.0"
        }

        self.flash_capture_config = {
            "iso": "100",
            "shutter_speed": "1/125",  # Studio strobe sync speed
            "white_balance": "Flash",
            "aperture": "f/8.0"
        }

        self.detect_camera()

    def detect_camera(self) -> Dict[str, Any]:
        """Detect connected Canon camera via USB"""
        if self.use_gphoto:
            try:
                res = subprocess.run(["gphoto2", "--auto-detect"], capture_output=True, text=True, timeout=5)
                if "Canon" in res.stdout:
                    self.is_connected = True
                    lines = [l for l in res.stdout.split("\n") if "Canon" in l]
                    if lines:
                        self.camera_model = lines[0].split("  ")[0].strip()
                    return {"connected": True, "model": self.camera_model, "driver": "gphoto2-edsdk"}
            except Exception as e:
                print(f"[Camera] Detection error: {e}")

        # Fallback simulation / UVC detection
        self.is_connected = True
        return {
            "connected": True,
            "model": self.camera_model,
            "driver": "native-usb-fallback",
            "liveview_iso": self.liveview_config["iso"],
            "flash_iso": self.flash_capture_config["iso"]
        }

    def update_settings(self, profile: str, settings: Dict[str, str]) -> Dict[str, Any]:
        """Update Liveview or Flash Capture camera settings"""
        target = self.liveview_config if profile == "liveview" else self.flash_capture_config
        for key in ["iso", "shutter_speed", "white_balance", "aperture"]:
            if key in settings:
                target[key] = settings[key]

        print(f"[Camera] Updated {profile} profile: {target}")
        return {"status": "success", "profile": profile, "settings": target}

    def set_camera_hardware_config(self, iso: str, shutter: str, wb: str):
        """Send PTP/EDSDK command to camera hardware"""
        if self.use_gphoto and self.is_connected:
            try:
                subprocess.run(["gphoto2", "--set-config", f"iso={iso}"], check=False, timeout=3)
                subprocess.run(["gphoto2", "--set-config", f"shutterspeed={shutter}"], check=False, timeout=3)
                subprocess.run(["gphoto2", "--set-config", f"whitebalance={wb}"], check=False, timeout=3)
            except Exception as e:
                print(f"[Camera] Hardware config error: {e}")

    def prepare_for_liveview(self):
        """Switch camera parameters to high-sensitivity liveview mode"""
        cfg = self.liveview_config
        self.set_camera_hardware_config(cfg["iso"], cfg["shutter_speed"], cfg["white_balance"])

    def trigger_flash_capture(self, save_path: Optional[str] = None) -> Dict[str, Any]:
        """
        1. Switch camera to Flash Capture parameters (Low ISO, 1/125s Flash Sync)
        2. Fire physical camera shutter & strobe trigger
        3. Switch back to Liveview parameters
        """
        flash_cfg = self.flash_capture_config
        print(f"[Camera] Switching to Flash profile: ISO {flash_cfg['iso']}, {flash_cfg['shutter_speed']}")
        self.set_camera_hardware_config(flash_cfg["iso"], flash_cfg["shutter_speed"], flash_cfg["white_balance"])

        output_file = save_path or f"/tmp/capture_{int(time.time()*1000)}.jpg"

        if self.use_gphoto and self.is_connected:
            try:
                subprocess.run(
                    ["gphoto2", "--capture-image-and-download", f"--filename={output_file}"],
                    capture_output=True,
                    timeout=10
                )
            except Exception as e:
                print(f"[Camera] Hardware shutter trigger error: {e}")

        # Switch back to live preview mode immediately
        self.prepare_for_liveview()

        return {
            "status": "success",
            "file_path": output_file,
            "flash_settings_applied": flash_cfg
        }

canon_camera = CanonCameraController()
