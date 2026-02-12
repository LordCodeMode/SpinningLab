# External Asset Pipeline (Realism)

## Included now
- Scanned PBR texture overrides from Poly Haven (road, grass, dirt, rock, gravel).
- Import command: `npm run assets:polyhaven`
- Ultra command: `npm run assets:polyhaven:ultra`
- Target folder: `frontend/public/textures/environment/polyhaven/`

## Premium model override slots
If these files exist, the world loads them first. If not, it falls back to current built-in assets.

### Trees
- `frontend/public/models/environment/premium/trees/conifer_high.glb`
- `frontend/public/models/environment/premium/trees/conifer_mid.glb`
- `frontend/public/models/environment/premium/trees/conifer_low.glb`
- `frontend/public/models/environment/premium/trees/oak_high.glb`
- `frontend/public/models/environment/premium/trees/oak_mid.glb`
- `frontend/public/models/environment/premium/trees/oak_low.glb`
- `frontend/public/models/environment/premium/trees/cypress_high.glb`
- `frontend/public/models/environment/premium/trees/cypress_mid.glb`
- `frontend/public/models/environment/premium/trees/cypress_low.glb`

### Shrubs
- `frontend/public/models/environment/premium/shrubs/lush_high.glb`
- `frontend/public/models/environment/premium/shrubs/lush_mid.glb`
- `frontend/public/models/environment/premium/shrubs/lush_low.glb`
- `frontend/public/models/environment/premium/shrubs/dry_high.glb`
- `frontend/public/models/environment/premium/shrubs/dry_mid.glb`
- `frontend/public/models/environment/premium/shrubs/dry_low.glb`

### Ground Plants
- `frontend/public/models/environment/premium/plants/fern_high.glb`
- `frontend/public/models/environment/premium/plants/fern_mid.glb`
- `frontend/public/models/environment/premium/plants/fern_low.glb`
- `frontend/public/models/environment/premium/plants/grass_high.glb`
- `frontend/public/models/environment/premium/plants/grass_mid.glb`
- `frontend/public/models/environment/premium/plants/grass_low.glb`

### Props / Structures
- `frontend/public/models/environment/premium/props/fence_high.glb`
- `frontend/public/models/environment/premium/props/fence_mid.glb`
- `frontend/public/models/environment/premium/props/fence_low.glb`
- `frontend/public/models/environment/premium/props/hay_high.glb`
- `frontend/public/models/environment/premium/props/hay_mid.glb`
- `frontend/public/models/environment/premium/props/hay_low.glb`
- `frontend/public/models/environment/premium/props/powerline_high.glb`
- `frontend/public/models/environment/premium/props/powerline_mid.glb`
- `frontend/public/models/environment/premium/props/powerline_low.glb`
- `frontend/public/models/environment/premium/props/rock_high.glb`
- `frontend/public/models/environment/premium/props/rock_mid.glb`
- `frontend/public/models/environment/premium/props/rock_low.glb`
- `frontend/public/models/environment/premium/props/barn_high.glb`
- `frontend/public/models/environment/premium/props/barn_mid.glb`
- `frontend/public/models/environment/premium/props/barn_low.glb`

## Notes
- For best runtime performance, use game-optimized assets with authored LODs and billboard/impostor cards.
- Very high-poly scan assets should be decimated and re-LODed before drop-in use.
