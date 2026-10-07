; QuickPic Hardware Daemon - Windows NSIS Installer
; This script creates a professional Windows installer (.exe/.msi)
; To build: Install NSIS, then run: makensis installer-windows.nsi

!include "MUI2.nsh"
!include "x64.nsh"

; Basic installer settings
Name "QuickPic Hardware Daemon"
OutFile "QuickPic-Hardware-Daemon-Installer.exe"
InstallDir "$PROGRAMFILES\QuickPic\HardwareDaemon"
InstallDirRegKey HKCU "Software\QuickPic\HardwareDaemon" ""
RequestExecutionLevel admin

; MUI Settings
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; ============================================
; Installer Sections
; ============================================

Section "Install"
  ; Check Python installation
  Call CheckPython

  ; Check gphoto2 installation
  Call CheckGphoto2

  ; Install application files
  SetOutPath "$INSTDIR"
  File "app.py"
  File "camera_controller.py"
  File "dnp_spooler.py"
  File "requirements.txt"
  File "README.md"
  File "start-daemon.bat"

  ; Create subdirectories
  CreateDirectory "$INSTDIR\logs"
  CreateDirectory "$INSTDIR\temp"

  ; Install Python dependencies
  DetailPrint "Installing Python dependencies..."
  nsExec::ExecToLog '"python" -m pip install -r "$INSTDIR\requirements.txt"'

  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\QuickPic"
  CreateShortcut "$SMPROGRAMS\QuickPic\Hardware Daemon.lnk" "$INSTDIR\start-daemon.bat"
  CreateShortcut "$SMPROGRAMS\QuickPic\Hardware Daemon (with Console).lnk" "cmd.exe" "/k cd /d $INSTDIR && python app.py"
  CreateShortcut "$SMPROGRAMS\QuickPic\Uninstall Hardware Daemon.lnk" "$INSTDIR\Uninstall.exe"

  ; Create Desktop shortcut
  CreateShortcut "$DESKTOP\QuickPic Hardware Daemon.lnk" "$INSTDIR\start-daemon.bat"

  ; Store installation folder
  WriteRegStr HKCU "Software\QuickPic\HardwareDaemon" "" $INSTDIR

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuickPicHardwareDaemon" "DisplayName" "QuickPic Hardware Daemon"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuickPicHardwareDaemon" "UninstallString" "$INSTDIR\Uninstall.exe"

  ; Display success message
  MessageBox MB_OK "QuickPic Hardware Daemon installed successfully!$\n$\nNext Steps:$\n1. Connect Canon camera via USB-C$\n2. Connect DNP printer via USB$\n3. Run 'Hardware Daemon' from Start Menu$\n4. Access API at http://localhost:8000"
SectionEnd

Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\app.py"
  Delete "$INSTDIR\camera_controller.py"
  Delete "$INSTDIR\dnp_spooler.py"
  Delete "$INSTDIR\requirements.txt"
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\start-daemon.bat"
  Delete "$INSTDIR\Uninstall.exe"

  ; Remove directories
  RMDir "$INSTDIR\logs"
  RMDir "$INSTDIR\temp"
  RMDir "$INSTDIR"

  ; Remove Start Menu shortcuts
  RMDir /r "$SMPROGRAMS\QuickPic"

  ; Remove Desktop shortcut
  Delete "$DESKTOP\QuickPic Hardware Daemon.lnk"

  ; Remove registry entries
  DeleteRegKey HKCU "Software\QuickPic\HardwareDaemon"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\QuickPicHardwareDaemon"
SectionEnd

; ============================================
; Functions
; ============================================

Function CheckPython
  DetailPrint "Checking Python installation..."

  ; Try to run python --version
  nsExec::ExecToStack "python --version"
  Pop $0

  ${If} $0 == 0
    DetailPrint "Python found"
  ${Else}
    MessageBox MB_YESNO "Python is not installed or not in PATH.$\n$\nWould you like to download Python from python.org?" IDYES DownloadPython IDNO SkipPython

    DownloadPython:
      ExecShell "open" "https://www.python.org/downloads/windows/"
      MessageBox MB_OK "Please install Python 3.8+ and add it to PATH, then run this installer again."
      Abort

    SkipPython:
      MessageBox MB_OK "Installation cannot continue without Python."
      Abort
  ${EndIf}
FunctionEnd

Function CheckGphoto2
  DetailPrint "Checking gphoto2 installation..."

  ; Try to run gphoto2 --version
  nsExec::ExecToStack "gphoto2 --version"
  Pop $0

  ${If} $0 == 0
    DetailPrint "gphoto2 found"
  ${Else}
    MessageBox MB_YESNO "gphoto2 is not installed.$\n$\nWould you like to download gphoto2?" IDYES DownloadGphoto2 IDNO SkipGphoto2

    DownloadGphoto2:
      ExecShell "open" "https://sourceforge.net/projects/gphoto/files/gphoto2/"
      MessageBox MB_OK "Please install gphoto2 and add it to PATH, then run this installer again."
      Abort

    SkipGphoto2:
      MessageBox MB_ICONINFORMATION "gphoto2 is required for camera control. You can install it later from https://sourceforge.net/projects/gphoto/files/gphoto2/"
  ${EndIf}
FunctionEnd
