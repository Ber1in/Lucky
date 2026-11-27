#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

: "${LUCKY_KEYSTORE:?set LUCKY_KEYSTORE to the release keystore path}"
: "${LUCKY_STORE_PASSWORD:?set LUCKY_STORE_PASSWORD}"
export LUCKY_KEY_ALIAS="${LUCKY_KEY_ALIAS:-lucky}"
export LUCKY_KEY_PASSWORD="${LUCKY_KEY_PASSWORD:-$LUCKY_STORE_PASSWORD}"

npx expo prebuild --platform android --clean

python3 - <<'PY'
from pathlib import Path

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
PY

cd android
./gradlew assembleRelease
