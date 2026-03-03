import { describe, expect, it } from 'vitest';
import { RoadRibbonBuilder } from '../src/virtual-world/environment/road/RoadRibbonBuilder.js';
import { RouteManager } from '../src/virtual-world/routes.js';

describe('RoadRibbonBuilder', () => {
  it('builds a continuous strip without NaN vertices', () => {
    const builder = new RoadRibbonBuilder();
    const samples = [];
    for (let i = 0; i <= 100; i += 1) {
      const d = i * 2;
      samples.push({
        distance: d,
        x: Math.sin(d * 0.02) * 2,
        y: Math.cos(d * 0.01) * 0.5,
        z: d,
        heading: Math.sin(d * 0.015) * 0.08
      });
    }

    const geometry = builder.buildStripGeometry(samples, {
      width: 10,
      offset: 0,
      yOffset: 0
    });

    const positions = geometry.attributes.position.array;
    const indices = geometry.index.array;
    expect(positions.length).toBeGreaterThan(0);
    expect(indices.length).toBeGreaterThan(0);
    for (let i = 0; i < positions.length; i += 1) {
      expect(Number.isFinite(positions[i])).toBe(true);
    }
  });
});

describe('RouteManager.getRoadFrame', () => {
  it('returns coherent seam heading/altitude on hilly route', () => {
    const manager = new RouteManager();
    const changed = manager.setRoute('hilly-route');
    expect(changed).toBe(true);

    const totalDistance = manager.getCurrentRoute().totalDistance;
    const a = manager.getRoadFrame(0);
    const b = manager.getRoadFrame(totalDistance);

    expect(Math.abs(a.altitude - b.altitude)).toBeLessThan(0.5);
    const headingDelta = Math.atan2(Math.sin(a.heading - b.heading), Math.cos(a.heading - b.heading));
    expect(Math.abs(headingDelta)).toBeLessThan(0.05);
  });
});
