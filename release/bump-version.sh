#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: bump-version.sh <version>"
    exit 1
fi

echo "Bumping version to $VERSION..."

# Update root Cargo.toml (workspace)
sed -i "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" Cargo.toml

# Update tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" apps/launcher/tauri.conf.json

# Update sub-package versions
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" apps/renderer/package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" packages/ui/package.json

# Update Cargo.lock
cargo update -p mrunner -p bookmarks

# Stage the changes
git add Cargo.toml apps/launcher/tauri.conf.json Cargo.lock apps/renderer/package.json packages/ui/package.json

echo "Version bumped to $VERSION"
