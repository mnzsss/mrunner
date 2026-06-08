# Tauri v2 Distribution Reference

## Table of Contents

1. [Build Command and Options](#build-command-and-options)
2. [Code Signing - macOS](#code-signing---macos)
3. [Code Signing - Windows](#code-signing---windows)
4. [Code Signing - Linux](#code-signing---linux)
5. [GitHub Actions CI/CD Pipeline](#github-actions-cicd-pipeline)
6. [Windows Installer (NSIS/WiX)](#windows-installer-nsiswix)
7. [macOS DMG](#macos-dmg)
8. [Linux AppImage](#linux-appimage)

---

## Build Command and Options

```bash
pnpm tauri build          # full build + bundle
pnpm tauri build -- --no-bundle   # compile only, no installer
pnpm tauri bundle -- --bundles app,dmg   # bundle specific formats
pnpm tauri bundle -- --bundles app --config src-tauri/tauri.appstore.conf.json
```

Version is read from `tauri.conf.json > version`, falling back to `Cargo.toml > package.version`.

> Source: <https://v2.tauri.app/distribute/>

---

## Code Signing - macOS

### Certificate Setup

Create a certificate at <https://developer.apple.com/account/resources/certificates/list>:
- **Apple Distribution** -- App Store submission
- **Developer ID Application** -- outside App Store (Account Holder only)

Find your signing identity:

```bash
security find-identity -v -p codesigning
```

Configure in `tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "CERTIFICATE_NAME"
    }
  }
}
```

Or via env var: `export APPLE_SIGNING_IDENTITY="CERTIFICATE_NAME"`

Ad-hoc signing (no Apple account, users must manually approve):

```json
{ "bundle": { "macOS": { "signingIdentity": "-" } } }
```

### CI/CD Certificate Import

Export `.p12` from Keychain Access, then base64-encode:

```bash
openssl base64 -A -in /path/to/certificate.p12 -out certificate-base64.txt
```

GitHub Actions step:

```yaml
- name: Import Apple Developer Certificate
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
  run: |
    echo $APPLE_CERTIFICATE | base64 --decode > certificate.p12
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security set-keychain-settings -t 3600 -u build.keychain
    security import certificate.p12 -k build.keychain -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain
```

### Notarization

**Option A -- App Store Connect API** (recommended for CI):
- `APPLE_API_ISSUER` -- issuer ID
- `APPLE_API_KEY` -- key ID
- `APPLE_API_KEY_PATH` -- path to downloaded `.p8` private key

**Option B -- Apple ID**:
- `APPLE_ID` -- account email
- `APPLE_PASSWORD` -- app-specific password
- `APPLE_TEAM_ID` -- from membership page

> Source: <https://v2.tauri.app/distribute/sign/macos/>

---

## Code Signing - Windows

### OV Certificate

```bash
openssl pkcs12 -export -in cert.cer -inkey private-key.key -out certificate.pfx
```

```powershell
Import-PfxCertificate -FilePath certificate.pfx -CertStoreLocation Cert:\CurrentUser\My -Password (ConvertTo-SecureString -String $WINDOWS_PFX_PASSWORD -Force -AsPlainText)
```

Config in `tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "A1B1A2B2...",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.comodoca.com"
    }
  }
}
```

GitHub Actions step:

```yaml
- name: Import Windows certificate
  if: matrix.platform == 'windows-latest'
  env:
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
    WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: |
    New-Item -ItemType directory -Path certificate
    Set-Content -Path certificate/tempCert.txt -Value $env:WINDOWS_CERTIFICATE
    certutil -decode certificate/tempCert.txt certificate/certificate.pfx
    Remove-Item -path certificate -include tempCert.txt
    Import-PfxCertificate -FilePath certificate/certificate.pfx -CertStoreLocation Cert:\CurrentUser\My -Password (ConvertTo-SecureString -String $env:WINDOWS_CERTIFICATE_PASSWORD -Force -AsPlainText)
```

### Azure Key Vault (signCommand)

`src-tauri/relic.conf`:

```conf
tokens:
  azure:
    type: azure
keys:
  azure:
    token: azure
    id: https://<KEY_VAULT_NAME>.vault.azure.net/certificates/<CERTIFICATE_NAME>
```

```json
{
  "bundle": {
    "windows": {
      "signCommand": "relic sign --file %1 --key azure --config relic.conf"
    }
  }
}
```

Env vars: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`.

### Azure Trusted Signing

```bash
cargo install trusted-signing-cli
```

```json
{
  "bundle": {
    "windows": {
      "signCommand": "trusted-signing-cli -e https://wus2.codesigning.azure.net -a MyAccount -c MyProfile -d MyApp %1"
    }
  }
}
```

> Source: <https://v2.tauri.app/distribute/sign/windows/>

---

## Code Signing - Linux

### AppImage GPG Signing

```bash
gpg2 --full-gen-key
```

Set env vars before `tauri build`:

```bash
export SIGN=1
export SIGN_KEY=your-key-id                    # optional
export APPIMAGETOOL_SIGN_PASSPHRASE=passphrase # required in CI
export APPIMAGETOOL_FORCE_SIGN=1               # fail on signing error
```

Verify signature:

```bash
./MyApp.AppImage --appimage-signature
# or use the validate tool from AppImageUpdate releases
chmod +x validate-x86_64.AppImage
./validate-x86_64.AppImage MyApp.AppImage
```

Note: AppImage does NOT validate signatures itself; users must verify manually.

> Source: <https://v2.tauri.app/distribute/sign/linux/>

---

## GitHub Actions CI/CD Pipeline

Full multi-platform workflow using `tauri-apps/tauri-action@v0`:

```yaml
name: 'publish'
on:
  workflow_dispatch:
  push:
    branches:
      - release

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies (ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Setup node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: pnpm install

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: app-v__VERSION__
          releaseName: 'App v__VERSION__'
          releaseBody: 'See the assets to download this version and install.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

**Troubleshooting**: If you get "Resource not accessible", enable read/write permissions under repo Settings > Actions > Workflow permissions.

> Source: <https://v2.tauri.app/distribute/pipelines/github/>

---

## Windows Installer (NSIS/WiX)

### Cross-Compilation (Linux/macOS to Windows)

```bash
# Ubuntu
sudo apt install nsis lld llvm clang

# macOS
brew install nsis llvm

# All platforms
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

### Alternative Architectures

```bash
rustup target add i686-pc-windows-msvc      # 32-bit
pnpm tauri build -- --target i686-pc-windows-msvc

rustup target add aarch64-pc-windows-msvc   # ARM64
pnpm tauri build -- --target aarch64-pc-windows-msvc
```

### WebView2 Install Modes

```json
{ "bundle": { "windows": { "webviewInstallMode": { "type": "downloadBootstrapper" } } } }
{ "bundle": { "windows": { "webviewInstallMode": { "type": "embedBootstrapper" } } } }
{ "bundle": { "windows": { "webviewInstallMode": { "type": "offlineInstaller" } } } }
{ "bundle": { "windows": { "webviewInstallMode": { "type": "fixedRuntime", "path": "./Microsoft.WebView2.FixedVersionRuntime.x.x.x.x64/" } } } }
```

### NSIS Hooks

`hooks.nsh`:

```nsh
!macro NSIS_HOOK_PREINSTALL
  MessageBox MB_OK "PreInstall"
!macroend
!macro NSIS_HOOK_POSTINSTALL
  MessageBox MB_OK "PostInstall"
!macroend
!macro NSIS_HOOK_PREUNINSTALL
  MessageBox MB_OK "PreUnInstall"
!macroend
!macro NSIS_HOOK_POSTUNINSTALL
  MessageBox MB_OK "PostUninstall"
!macroend
```

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "installerHooks": "./windows/hooks.nsh",
        "installMode": "both",
        "languages": ["en-US", "pt-BR"],
        "displayLanguageSelector": true,
        "minimumWebview2Version": "110.0.1531.0"
      }
    }
  }
}
```

### WiX Customization

```json
{
  "bundle": {
    "windows": {
      "wix": {
        "template": "./path/to/custom.wxs",
        "fragmentPaths": ["./windows/fragments/registry.wxs"],
        "componentRefs": ["MyFragmentRegistryEntries"],
        "language": { "en-US": null, "pt-BR": { "localePath": "./wix/locales/pt-BR.wxl" } }
      }
    }
  }
}
```

Note: MSI can only be built on Windows. Building MSI requires the VBSCRIPT optional Windows feature.

> Source: <https://v2.tauri.app/distribute/windows-installer/>

---

## macOS DMG

```bash
pnpm tauri build -- --bundles dmg
```

Configuration in `tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "dmg": {
        "background": "./images/dmg-bg.png",
        "windowSize": { "width": 800, "height": 600 },
        "windowPosition": { "x": 400, "y": 400 },
        "appPosition": { "x": 180, "y": 220 },
        "applicationFolderPosition": { "x": 480, "y": 220 }
      }
    }
  }
}
```

Note: Icon sizes and positions do not apply when building on CI/CD platforms (tauri-apps/tauri#1731). GUI apps do not inherit shell `$PATH`; use [fix-path-env-rs](https://github.com/tauri-apps/fix-path-env-rs).

> Source: <https://v2.tauri.app/distribute/dmg/>

---

## Linux AppImage

```bash
pnpm tauri build -- --bundles appimage
```

### Configuration

```json
{
  "bundle": {
    "linux": {
      "appimage": {
        "bundleMediaFramework": true,
        "files": {
          "/usr/share/README.md": "../README.md",
          "/usr/assets": "../assets/"
        }
      }
    }
  }
}
```

Custom file paths must begin with `/usr/`.

### glibc Compatibility

Build on the **oldest** target system. Building on Ubuntu 22.04 produces binaries incompatible with older glibc versions. Use Docker or CI targeting old distributions.

### User Installation

```bash
chmod a+x MyProject.AppImage
./MyProject.AppImage
```

GUI apps do not inherit shell `$PATH`; use [fix-path-env-rs](https://github.com/tauri-apps/fix-path-env-rs).

> Source: <https://v2.tauri.app/distribute/appimage/>
