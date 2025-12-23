#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

VERSION=$(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')
AUR_REPO="ssh://aur@aur.archlinux.org/mrunner.git"
GITHUB_REPO="mnzsss/mrunner"

echo -e "${GREEN}Publishing MRunner v$VERSION to AUR...${NC}"

# Check if version tag exists on remote
if ! git ls-remote --tags origin | grep -q "v$VERSION"; then
    echo -e "${RED}Error: Tag v$VERSION not found on remote. Run 'pnpm release' first.${NC}"
    exit 1
fi

# Wait for GitHub release artifacts
echo -e "${YELLOW}Waiting for GitHub release artifacts...${NC}"
RELEASE_URL="https://github.com/$GITHUB_REPO/releases/download/v$VERSION/mrunner-$VERSION-linux-x86_64.AppImage"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl --output /dev/null --silent --head --fail "$RELEASE_URL"; then
        echo -e "${GREEN}Release artifacts found!${NC}"
        break
    fi
    echo "Waiting for release... (attempt $((ATTEMPT+1))/$MAX_ATTEMPTS)"
    sleep 10
    ATTEMPT=$((ATTEMPT+1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}Error: Release artifacts not found after $MAX_ATTEMPTS attempts${NC}"
    exit 1
fi

# Download and calculate checksum
echo -e "${YELLOW}Calculating checksum...${NC}"
TEMP_FILE=$(mktemp)
curl -L -o "$TEMP_FILE" "$RELEASE_URL"
SHA256=$(sha256sum "$TEMP_FILE" | cut -d ' ' -f1)
rm "$TEMP_FILE"

echo "SHA256: $SHA256"

# Update PKGBUILD
echo -e "${YELLOW}Updating PKGBUILD...${NC}"
sed -i "s/^pkgver=.*/pkgver=$VERSION/" aur/PKGBUILD
sed -i "s/^sha256sums=.*/sha256sums=('$SHA256')/" aur/PKGBUILD
sed -i "s/^pkgrel=.*/pkgrel=1/" aur/PKGBUILD

# Generate .SRCINFO
echo -e "${YELLOW}Generating .SRCINFO...${NC}"
cd aur
makepkg --printsrcinfo > .SRCINFO

# Clone AUR repo and update
echo -e "${YELLOW}Pushing to AUR...${NC}"
cd ..
TEMP_DIR=$(mktemp -d)
git clone "$AUR_REPO" "$TEMP_DIR"
cp aur/PKGBUILD "$TEMP_DIR/"
cp aur/.SRCINFO "$TEMP_DIR/"

cd "$TEMP_DIR"
git add PKGBUILD .SRCINFO
git commit -m "Update to v$VERSION"
git push

cd ..
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Successfully published MRunner v$VERSION to AUR!${NC}"
echo -e "${GREEN}Users can now install with: yay -S mrunner${NC}"
