import { describe, expect, it } from 'vitest';
import { RidePhysicsEngine } from '../src/virtual-world/physics/RidePhysicsEngine.js';

describe('RidePhysicsEngine', () => {
  it('produces realistic climbing speed at 6% for mid-range power', () => {
    const engine = new RidePhysicsEngine({
      riderWeightKg: 75,
      bikeWeightKg: 8
    });

    let speed = 0;
    for (let i = 0; i < 180; i += 1) {
      const step = engine.step({
        dt: 1,
        powerW: 245,
        cadenceRpm: 88,
        grade: 0.06
      });
      speed = step.speedKph;
    }

    expect(speed).toBeGreaterThan(11);
    expect(speed).toBeLessThan(22);
  });

  it('accelerates downhill when coasting', () => {
    const engine = new RidePhysicsEngine();
    engine.setSpeedKph(8);

    let speed = 0;
    for (let i = 0; i < 24; i += 1) {
      const step = engine.step({
        dt: 1,
        powerW: 0,
        cadenceRpm: 0,
        grade: -0.06
      });
      speed = step.speedKph;
    }

    expect(speed).toBeGreaterThan(25);
  });

  it('clamps unrealistic grade input to realistic bounds', () => {
    const engine = new RidePhysicsEngine();
    const step = engine.step({
      dt: 1,
      powerW: 220,
      cadenceRpm: 85,
      grade: 0.3
    });
    expect(step.grade).toBeLessThanOrEqual(0.12);
    expect(step.grade).toBeGreaterThanOrEqual(-0.12);
  });
});
