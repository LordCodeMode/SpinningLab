# Unity WebGL Integration (No iCloud Paths)

## Source + Build Paths

- Unity project source path (required):
  - `~/Developer/Unity/training-world`
- Local build artifacts root (required):
  - `~/Developer/UnityBuilds/training-dashboard`

The preflight script rejects iCloud-sensitive locations (`~/Desktop`, `~/Documents`, `~/Library/Mobile Documents`, and `~/.Trash`).

## 1) Preflight

```bash
cd /Users/maxhartwig/Desktop/training-dashboard
bash scripts/unity/preflight-path-check.sh
```

## 2) Build Unity WebGL (from Unity CLI)

```bash
UNITY_DASHBOARD_BUILD_ROOT="$HOME/Developer/UnityBuilds/training-dashboard" \
UNITY_DASHBOARD_DEV_BASE_URL="http://127.0.0.1:9000/training-dashboard" \
/Applications/Unity/Hub/Editor/6000.3.8f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit \
  -projectPath "$HOME/Developer/Unity/training-world" \
  -executeMethod DashboardBuildRunner.BuildWebGL
```

This writes versioned outputs to:

- `~/Developer/UnityBuilds/training-dashboard/<version>/`
- plus `current.json` in `~/Developer/UnityBuilds/training-dashboard/`

## 3) Local Dashboard Manifest Update

```bash
cd /Users/maxhartwig/Desktop/training-dashboard/frontend
npm run unity:manifest:local
```

This updates:

- `frontend/public/unity/current.json`

## 4) Serve Local Unity Build Artifacts

```bash
python3 -m http.server 9000 --directory ~/Developer/UnityBuilds
```

The local dashboard manifest defaults to a same-origin path (`/unity-builds/...`).
`vite` proxies `/unity-builds` to `127.0.0.1:9000`, so Unity asset fetches are not blocked by browser CORS rules.

## 5) Production Publish (S3-compatible)

```bash
cd /Users/maxhartwig/Desktop/training-dashboard/frontend
UNITY_S3_BUCKET="<bucket>" \
UNITY_S3_PREFIX="training-dashboard-unity" \
UNITY_CDN_BASE_URL="https://cdn.example.com" \
npm run unity:publish:s3
```

Optional env vars:

- `UNITY_BUILD_VERSION` to publish a specific version folder
- `UNITY_LOCAL_MANIFEST_MIRROR=1` to mirror prod manifest to local `frontend/public/unity/current.json`
