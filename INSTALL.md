# Installation Instructions

This application is built with Electron and can be installed on Windows, macOS, and Linux.

## Download

Please download the appropriate installer for your operating system from the release page.

## Installation

### Windows

1.  Download the `.exe` installer (e.g., `MediaTracker AI Setup 1.0.0.exe`).
2.  Double-click the installer to run it.
3.  Follow the installation wizard instructions.
    *   You can choose the installation directory.
    *   A desktop shortcut will be created automatically.
4.  Once installed, you can launch the application from the Start Menu or Desktop shortcut.

### macOS

1.  Download the `.dmg` file (e.g., `MediaTracker AI-1.0.0.dmg`) or `.pkg` installer.
2.  **For DMG:**
    *   Open the `.dmg` file.
    *   Drag the "MediaTracker AI" icon to the "Applications" folder.
3.  **For PKG:**
    *   Double-click the `.pkg` file.
    *   Follow the installer instructions.
4.  Launch the application from Launchpad or the Applications folder.

### Linux

**Debian/Ubuntu (.deb)**

1.  Download the `.deb` package (e.g., `mediatracker-ai_1.0.0_amd64.deb`).
2.  Install using `dpkg` or `apt`:
    ```bash
    sudo dpkg -i mediatracker-ai_1.0.0_amd64.deb
    sudo apt-get install -f # Fix any missing dependencies
    ```
3.  Or double-click the file to open it in your software center.

**RedHat/CentOS/Fedora (.rpm)**

1.  Download the `.rpm` package (e.g., `mediatracker-ai-1.0.0.x86_64.rpm`).
2.  Install using `rpm` or `dnf`:
    ```bash
    sudo rpm -i mediatracker-ai-1.0.0.x86_64.rpm
    ```

## Uninstallation

*   **Windows:** Go to Control Panel > Programs > Uninstall a program, select "MediaTracker AI", and click Uninstall.
*   **macOS:** Drag the application from the Applications folder to the Trash.
*   **Linux:** Use your package manager (e.g., `sudo apt remove mediatracker-ai` or `sudo rpm -e mediatracker-ai`).
