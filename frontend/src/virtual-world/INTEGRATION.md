# Virtual World Integration Guide

This document shows how to add the Virtual World launch button to your LiveTrainingApp.

## Quick Integration

Add these changes to `LiveTrainingApp.jsx`:

### 1. Add Import (at the top)

```jsx
import { Globe } from 'lucide-react';
import { useVirtualWorld } from '../virtual-world/useVirtualWorld.js';
```

### 2. Add the Hook (inside the component)

```jsx
// After other useState declarations, add:
const virtualWorld = useVirtualWorld({
  liveMetrics,
  sessionState,
  currentStep,
  workoutSteps,
  elapsed: totalElapsed,
  stepElapsed,
  stepRemaining: remainingStep,
  distance: liveDistanceMeters,
  mode: 'erg'
});
```

### 3. Add the Button (in the controls section, around line 2289)

Find the `<div className="lt-controls">` section and add this button:

```jsx
<div className="lt-controls">
  {/* Existing buttons... */}

  {/* Add this Virtual World button */}
  <button
    className={`btn ${virtualWorld.isOpen ? 'btn--accent' : 'btn--secondary'}`}
    type="button"
    onClick={virtualWorld.toggle}
    disabled={virtualWorld.isLaunching}
    title={virtualWorld.isOpen ? 'Close Virtual World' : 'Open Virtual World'}
  >
    <Globe size={16} />
    {virtualWorld.isLaunching
      ? 'Opening...'
      : virtualWorld.isOpen
        ? 'Virtual World'
        : 'Virtual World'}
  </button>

  {/* Rest of existing buttons... */}
</div>
```

## What Gets Synced

When the Virtual World is open, it automatically receives:

- **Live metrics**: Power, cadence, heart rate, speed
- **Workout data**: Current step, all steps, progress
- **Session state**: Running, paused, stopped
- **Distance**: Traveled distance for route position

## Routes Available

The virtual world includes these routes:

| Route | Distance | Elevation | Difficulty |
|-------|----------|-----------|------------|
| Rolling Hills | 20 km | 280m | Easy |
| Mountain Climb | 15 km | 650m | Hard |
| Flat Loop | 10 km | 50m | Easy |
| Alpine Challenge | 25 km | 1200m | Extreme |
| Interval Hills | 12 km | 400m | Medium |

## Keyboard Shortcuts (in Virtual World window)

- **F**: Toggle fullscreen
- **Escape**: Exit fullscreen

## SIM Mode (Future)

The route system includes gradient data that can be sent to your trainer for resistance simulation. The `getTrainerGradient(distance)` method returns the gradient at any position.

## Files Created

```
frontend/
├── virtual-ride.html           # Entry point for virtual world
├── src/virtual-world/
│   ├── main.js                 # App initialization
│   ├── scene.js                # Three.js 3D world
│   ├── hud.js                  # Stats overlay
│   ├── routes.js               # Route system with elevation
│   ├── bridge.js               # BroadcastChannel communication
│   ├── launcher.js             # Window management
│   ├── useVirtualWorld.js      # React hook
│   └── index.js                # Exports
```

## Install & Run

```bash
cd frontend
npm install   # Installs three.js
npm run dev
```

Then open Live Training and click the "Virtual World" button!
