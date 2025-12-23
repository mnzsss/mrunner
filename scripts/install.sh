#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BINARY="$PROJECT_DIR/src-tauri/target/release/mrunner"
ICON="$PROJECT_DIR/src-tauri/icons/128x128.png"

if [ ! -f "$BINARY" ]; then
  echo "Error: Binary not found. Run 'pnpm tauri build' first."
  exit 1
fi

echo "Installing MRunner..."

# Install binary
sudo install -Dm755 "$BINARY" /usr/local/bin/mrunner

# Install icon
sudo install -Dm644 "$ICON" /usr/share/icons/hicolor/128x128/apps/mrunner.png

# Create wrapper script (forces X11 backend for Wayland compatibility)
sudo tee /usr/local/bin/mrunner-wrapper > /dev/null << 'EOF'
#!/bin/bash
export GDK_BACKEND=x11
export WEBKIT_DISABLE_DMABUF_RENDERER=1
exec /usr/local/bin/mrunner "$@"
EOF
sudo chmod +x /usr/local/bin/mrunner-wrapper

# Create .desktop entry
sudo tee /usr/share/applications/mrunner.desktop > /dev/null << 'EOF'
[Desktop Entry]
Name=MRunner
Comment=Command launcher
Exec=env GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 mrunner
Icon=mrunner
Terminal=false
Type=Application
Categories=Utility;
StartupWMClass=mrunner
EOF

# Update icon cache
sudo gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true

echo "MRunner installed successfully!"
echo "Run 'mrunner' or use Super+Space to launch."
