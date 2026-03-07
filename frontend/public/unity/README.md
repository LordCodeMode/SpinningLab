# Unity Manifest (Local Dev)

`current.json` is intentionally small and points to external build artifacts.

## Local workflow

1. Build Unity WebGL into `~/Developer/UnityBuilds/training-dashboard/<version>`.
2. Serve build artifacts from `~/Developer/UnityBuilds`:
   - `python3 -m http.server 9000 --directory ~/Developer/UnityBuilds`
3. Run frontend with Vite (`npm run dev`), which proxies `/unity-builds/*` to `127.0.0.1:9000`.
4. Update `current.json` via `../scripts/unity/publish-build.mjs --target local`.

Do not commit Unity WebGL binaries into this repository.
