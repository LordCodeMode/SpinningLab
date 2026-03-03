import { describe, expect, it } from 'vitest';
import { PerformanceController } from '../src/virtual-world/perf/PerformanceController.js';

function tickForSeconds(controller, seconds, frameMs) {
  const dt = frameMs / 1000;
  const frames = Math.max(1, Math.round(seconds / dt));
  let last = null;
  for (let i = 0; i < frames; i += 1) {
    last = controller.tick(dt);
  }
  return last;
}

describe('PerformanceController', () => {
  it('degrades under sustained frame pressure and upgrades after recovery', () => {
    const controller = new PerformanceController({
      enabled: true,
      routeScope: 'hilly-route',
      targetFps: 60,
      upgradeAfterMs: 2000
    });

    const configured = controller.configureRoute('hilly-route', {
      mode: 'adaptive',
      minLevel: 1,
      maxLevel: 4,
      targetFps: 60
    });
    expect(configured.level).toBe(1);

    tickForSeconds(controller, 5.2, 33.3);
    expect(controller.getState().level).toBeGreaterThanOrEqual(2);

    tickForSeconds(controller, 4.8, 33.3);
    const peakLevel = controller.getState().level;
    expect(peakLevel).toBeGreaterThanOrEqual(2);

    tickForSeconds(controller, 12, 11.1);
    expect(controller.getState().level).toBeLessThan(peakLevel);
    expect(controller.getState().level).toBeGreaterThanOrEqual(1);
  });

  it('respects minimum level hold to prevent oscillation', () => {
    const controller = new PerformanceController({
      enabled: true,
      routeScope: 'hilly-route',
      targetFps: 60,
      levelHoldMs: 4000
    });
    controller.configureRoute('hilly-route', {
      mode: 'adaptive',
      minLevel: 1,
      maxLevel: 2
    });

    tickForSeconds(controller, 2.5, 33.3);
    expect(controller.getState().level).toBe(1);

    tickForSeconds(controller, 2.2, 33.3);
    expect(controller.getState().level).toBe(2);

    tickForSeconds(controller, 2.5, 11.1);
    expect(controller.getState().level).toBe(2);
  });

  it('disables adaptive scaling outside route scope', () => {
    const controller = new PerformanceController({
      enabled: true,
      routeScope: 'hilly-route',
      targetFps: 60
    });

    controller.configureRoute('hilly-route', {
      mode: 'adaptive',
      minLevel: 1,
      maxLevel: 4
    });
    tickForSeconds(controller, 5.5, 33.3);
    expect(controller.getState().level).toBeGreaterThanOrEqual(2);

    const switched = controller.configureRoute('flat-loop', {
      mode: 'adaptive',
      minLevel: 1,
      maxLevel: 4
    });
    expect(switched.state.active).toBe(false);
    expect(switched.level).toBe(0);
  });
});
