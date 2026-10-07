# Building GUI Installers for QuickPic Hardware Daemon

This guide explains how to build professional GUI installers for Windows (.exe) and macOS (.dmg).

## Windows Installer (.exe)

### Prerequisites
- [NSIS (Nullsoft Scriptable Install System)](https://nsis.sourceforge.io/) - Free, open-source
- Windows machine (for building the installer)

### Build Steps

1. **Install NSIS:**
   - Download from: https://nsis.sourceforge.io/Download
   - Run the installer and follow the wizard

2. **Build the installer:**
   ```cmd
   cd hardware-daemon
   "C:\Program Files (x86)\NSIS\makensis.exe" installer-windows.nsi
   ```

3. **Output:**
   - Creates: `QuickPic-Hardware-Daemon-Installer.exe`
   - Size: ~50-100 MB (includes Python packages)

4. **Distribution:**
   - Upload `.exe` to GitHub Releases
   - Users download and run the installer
   - Installer handles all dependencies and setup

### What the Windows Installer Does

✅ Checks for Python installation (guides user if missing)  
✅ Checks for gphoto2 installation (guides user if missing)  
✅ Installs Python dependencies via pip  
✅ Creates Start Menu shortcuts  
✅ Creates Desktop shortcut  
✅ Provides uninstall option  

### Customization

Edit `installer-windows.nsi` to:
- Change installation directory (line 16: `InstallDir`)
- Add/remove files to install (Section "Install")
- Customize shortcuts and branding
- Add additional registry entries or services

---

## macOS Installer (.dmg)

### Prerequisites
- macOS machine (for building the installer)
- Xcode Command Line Tools: `xcode-select --install`
- Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

### Build Steps

1. **Install create-dmg tool:**
   ```bash
   brew install create-dmg
   ```

2. **Build the installer:**
   ```bash
   cd hardware-daemon
   chmod +x create-macos-dmg.sh
   ./create-macos-dmg.sh
   ```

3. **Output:**
   - Creates: `QuickPic-Hardware-Daemon-Installer.dmg`
   - Size: ~30-50 MB

4. **Distribution:**
   - Upload `.dmg` to GitHub Releases
   - Users download and double-click the .dmg
   - Drag app to Applications folder
   - Launch from Applications

### What the macOS Installer Does

✅ Creates an app bundle (.app)  
✅ Auto-detects and installs Python if needed  
✅ Creates Python virtual environment  
✅ Installs all Python dependencies  
✅ Provides easy drag-drop installation  
✅ Includes built-in launcher script  

### Customization

Edit `create-macos-dmg.sh` to:
- Change app name (line 16: `APP_DIR`)
- Modify DMG appearance (line 70+: `create-dmg` options)
- Update Info.plist version and identifiers
- Add custom background image

---

## Automated CI/CD Build (GitHub Actions)

To automate installer building on every release, add this to `.github/workflows/build-installers.yml`:

```yaml
name: Build Hardware Daemon Installers

on:
  workflow_dispatch:
  push:
    tags:
      - "daemon-v*"

jobs:
  build-windows-installer:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install NSIS
        run: choco install nsis -y
      - name: Build Windows Installer
        run: |
          cd hardware-daemon
          "C:\Program Files (x86)\NSIS\makensis.exe" installer-windows.nsi
      - name: Upload to Release
        uses: softprops/action-gh-release@v2
        with:
          files: hardware-daemon/*.exe

  build-macos-installer:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build macOS DMG
        run: |
          cd hardware-daemon
          ./create-macos-dmg.sh
      - name: Upload to Release
        uses: softprops/action-gh-release@v2
        with:
          files: hardware-daemon/*.dmg
```

Then tag releases with `daemon-v2.0.0` to automatically build installers.

---

## Distribution Workflow

1. **Build Installers** (locally or via CI/CD):
   ```bash
   # Windows: Open Git Bash and run
   cd hardware-daemon
   makensis installer-windows.nsi
   
   # macOS: Run
   cd hardware-daemon
   ./create-macos-dmg.sh
   ```

2. **Create GitHub Release:**
   - Create a new release on GitHub
   - Tag: `daemon-v2.0.0` (or similar)
   - Upload `.exe` and `.dmg` files
   - Write release notes

3. **Share with Users:**
   - Send link to GitHub Releases page
   - Users download appropriate installer for their OS
   - Users run installer and follow prompts

4. **First Launch:**
   - User double-clicks installer
   - Installer checks/installs dependencies
   - User launches app from Start Menu (Windows) or Applications (macOS)
   - Daemon runs at `http://localhost:8000`

---

## Troubleshooting

### Windows (.exe) issues:
- **"Python not found"**: Guide user to python.org
- **"gphoto2 not found"**: Guide user to sourceforge
- **Installation fails**: Check NSIS log in install directory

### macOS (.dmg) issues:
- **"Python not found"**: Script prompts to install via Homebrew
- **Permissions denied**: Ensure `create-macos-dmg.sh` is executable
- **DMG won't create**: Verify `create-dmg` is installed

---

## File Sizes

Typical installer sizes:
- **Windows .exe**: 80-150 MB (includes Python runtime option)
- **macOS .dmg**: 40-80 MB (lightweight, downloads Python on first run)

To reduce size:
- Use lightweight Python (Miniconda instead of full Python)
- Compress DMG with `hdiutil compress`
- Exclude unnecessary Python packages from requirements.txt
