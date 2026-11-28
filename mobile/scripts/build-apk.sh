#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${LUCKY_KEYSTORE:?set LUCKY_KEYSTORE to the release keystore path}"
: "${LUCKY_STORE_PASSWORD:?set LUCKY_STORE_PASSWORD}"
: "${LUCKY_CA_CERT:?set LUCKY_CA_CERT to the self-signed CA certificate path}"
export LUCKY_KEY_ALIAS="${LUCKY_KEY_ALIAS:-lucky}"
export LUCKY_KEY_PASSWORD="${LUCKY_KEY_PASSWORD:-$LUCKY_STORE_PASSWORD}"

npx expo prebuild --platform android --clean

mkdir -p android/app/src/main/res/raw android/app/src/main/res/xml
cp "$LUCKY_CA_CERT" android/app/src/main/res/raw/lucky_ca.pem
cat > android/app/src/main/res/xml/network_security_config.xml <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="@raw/lucky_ca" />
        </trust-anchors>
    </base-config>
</network-security-config>
XML

python3 - <<'PY'
from pathlib import Path

# Release signing config
path = Path("android/app/build.gradle")
text = path.read_text()
old_signing = """    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }"""
new_signing = """    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file(System.getenv("LUCKY_KEYSTORE"))
            storePassword System.getenv("LUCKY_STORE_PASSWORD")
            keyAlias System.getenv("LUCKY_KEY_ALIAS")
            keyPassword System.getenv("LUCKY_KEY_PASSWORD")
        }
    }"""
if old_signing not in text:
    raise SystemExit("signingConfigs block not found in android/app/build.gradle")
text = text.replace(old_signing, new_signing, 1)

old_release = "            signingConfig signingConfigs.debug\n            def enableShrinkResources"
new_release = "            signingConfig signingConfigs.release\n            def enableShrinkResources"
if old_release not in text:
    raise SystemExit("release buildType not found in android/app/build.gradle")
text = text.replace(old_release, new_release, 1)
path.write_text(text)

# Trust the self-signed CA instead of allowing cleartext traffic
manifest = Path("android/app/src/main/AndroidManifest.xml")
text = manifest.read_text()
needle = 'android:usesCleartextTraffic="true"'
replacement = 'android:networkSecurityConfig="@xml/network_security_config"'
if needle in text:
    text = text.replace(needle, replacement, 1)
elif replacement not in text:
    text = text.replace("<application ", f"<application {replacement} ", 1)
manifest.write_text(text)
PY

cd android
./gradlew assembleRelease
