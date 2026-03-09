import { describe, expect, it } from 'vitest';
import { RouteManager } from '../src/virtual-world/routes.js';

describe('RouteManager loop normalization', () => {
  it('closes near-complete loops so seam samples stay coherent', () => {
    const manager = new RouteManager([
      {
        id: 'test-loop',
        name: 'Test Loop',
        distanceMeters: 30,
        climbMeters: 8,
        points: [
          { x: 0, y: 0, z: 0, distanceMeters: 0, elevationMeters: 0 },
          { x: 10, y: 2, z: 0, distanceMeters: 10, elevationMeters: 2 },
          { x: 10, y: 4, z: 10, distanceMeters: 20, elevationMeters: 4 },
          { x: 1.8, y: 0.7, z: 1.2, distanceMeters: 30, elevationMeters: 0.7 }
        ]
      }
    ]);

    const route = manager.getActiveRoute();
    expect(route.totalDistanceMeters).toBeGreaterThan(30);

    const seamStart = manager.getPositionInfo(0);
    const seamEnd = manager.getPositionInfo(route.totalDistanceMeters - 0.5);

    const gap = Math.hypot(
      seamStart.position.x - seamEnd.position.x,
      seamStart.position.y - seamEnd.position.y,
      seamStart.position.z - seamEnd.position.z
    );

    expect(gap).toBeLessThan(1.5);
    expect(Math.abs(manager.getEffectiveGrade(0) - manager.getEffectiveGrade(route.totalDistanceMeters - 0.5))).toBeLessThan(0.1);
  });
});
