// Shared configuration + helpers for the Virtual World scene

export const ROAD_WIDTH = 12;
export const ROAD_SEGMENT_LENGTH = 20;
export const VISIBLE_SEGMENTS = 60;
export const TERRAIN_WIDTH = 94;

// Shared scaling so road/rider/camera stay aligned.
// Increased to make climbs/descents visually read as hills and mountain passes.
export const ALT_SCALE = 0.30;
export const REALISTIC_GRADIENT_LIMIT = 0.12; // +/-12% for displayed road gradients

// Convert gradient (either 0.08 or 8 for 8%) into a reasonable pitch angle (radians)
export function gradientToPitch(gradient) {
  const g = Number(gradient) || 0;
  const grade = Math.abs(g) > 1 ? (g / 100) : g; // 8 -> 0.08, 0.08 stays 0.08
  const visualGrade = grade * ALT_SCALE;
  const pitch = Math.atan(visualGrade);
  return Math.min(0.24, Math.max(-0.24, pitch));
}

// Realistic colors
export const COLORS = {
  // Road
  asphalt: 0x2d2d2d,
  asphaltLight: 0x3d3d3d,
  roadLine: 0xeeeeee,
  roadLineYellow: 0xf4c430,
  roadEdge: 0x1a1a1a,

  // Environment
  grass: 0x5f944e,
  grassLight: 0x71a95d,
  grassDark: 0x417039,
  dirt: 0x8b7355,
  rock: 0x6b6b6b,

  // Sky
  skyTop: 0x1e90ff,
  skyHorizon: 0x87ceeb,
  sunLight: 0xfffaf0,

  // Trees
  pine: 0x228b22,
  pineDark: 0x1a6b1a,
  oak: 0x2e8b2e,
  trunk: 0x4a3728,

  // Cyclist - NO BLUE JERSEY
  jersey: 0xff4400,
  jerseyAccent: 0xffcc00,
  shorts: 0x1a1a1a,
  skin: 0xe8beac,
  helmet: 0xf0f0f0,
  bike: 0xcc1f1f, // main frame red for contrast vs shorts/wheels
  bikeAccent: 0x111111,
  tire: 0x1c1f24,
  spoke: 0xcccccc,
  handlebar: 0x3a3a3a,

  // Mountains
  mountain: 0x5a6a7a,
  mountainSnow: 0xffffff,
  mountainDark: 0x4a5a6a
};

export const THEMES = {
  classic: {
    grass: 0x5f944e,
    grassLight: 0x71a95d,
    grassDark: 0x417039,
    skyTop: 0x1e90ff,
    skyHorizon: 0x87ceeb,
    mountain: 0x5a6a7a
  },
  alpine: {
    grass: 0x5a894a,
    grassLight: 0x6ca05b,
    grassDark: 0x3c5f37,
    skyTop: 0x3b6aa0,
    skyHorizon: 0xa6c4e1,
    mountain: 0x495868
  },
  coastal: {
    grass: 0x57905a,
    grassLight: 0x6bab72,
    grassDark: 0x3c6b53,
    skyTop: 0x3aa0d4,
    skyHorizon: 0xb4e0f5,
    mountain: 0x4f6377
  }
};
