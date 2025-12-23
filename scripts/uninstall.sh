#!/bin/bash
set -e

echo "Uninstalling MRunner..."

sudo rm -f /usr/local/bin/mrunner
sudo rm -f /usr/local/bin/mrunner-wrapper
sudo rm -f /usr/share/icons/hicolor/128x128/apps/mrunner.png
sudo rm -f /usr/share/applications/mrunner.desktop

# Update icon cache
sudo gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true

echo "MRunner uninstalled successfully!"
