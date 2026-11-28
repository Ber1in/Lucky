# Lucky Android App

React Native / Expo client for the Lucky lottery tracker. Android only, LAN usage.

## Features

- Login / register with a Bearer token
- Latest draw, pool, sales, next draw
- History, number statistics (1m / 3m / 1y / 3y, optional 9/6-tier periods)
- Bet records: grid number picker, add / edit / delete
- Weekly local notification on Mon / Wed / Sat 21:40: "开奖了，点开看结果"
- Configurable server address (default `http://192.168.5.14:18080`)

## Development

```bash
cd mobile
npm install
npx expo start
```

The app needs a development build for custom native config. For a release APK:

```bash
export LUCKY_KEYSTORE=/root/.lucky-keystore/lucky-release.keystore
export LUCKY_STORE_PASSWORD=<store password>
export LUCKY_KEY_PASSWORD=<key password>
export LUCKY_CA_CERT=/mnt/d/Downloads/lucky-ca.crt
./scripts/build-apk.sh
```

The build bundles the self-signed CA so the app trusts `https://47.108.230.103:8443`.

Output: `android/app/build/outputs/apk/release/app-release.apk`.

The keystore lives outside the repository and must be kept for future upgrades.
