/**
 * MotionGate
 *
 * Prevents false "auto-riding" from noisy low-value telemetry.
 * Requires short sustained effort to start movement and short sustained inactivity to stop.
 */
export class MotionGate {
  constructor(options = {}) {
    this.startCadence = options.startCadence ?? 18;
    this.startPower = options.startPower ?? 60;
    this.maintainCadence = options.maintainCadence ?? 10;
    this.maintainPower = options.maintainPower ?? 30;
    this.activationHoldSec = options.activationHoldSec ?? 0.45;
    this.releaseHoldSec = options.releaseHoldSec ?? 1.1;

    this.active = false;
    this.activationTimer = 0;
    this.releaseTimer = 0;
  }

  reset() {
    this.active = false;
    this.activationTimer = 0;
    this.releaseTimer = 0;
  }

  update(deltaSec, { sessionState, cadence, power }) {
    if (sessionState !== 'running') {
      this.reset();
      return false;
    }

    const c = Number(cadence) || 0;
    const p = Number(power) || 0;
    const strongEffort = c >= this.startCadence || p >= this.startPower;
    const sustainEffort = c >= this.maintainCadence || p >= this.maintainPower;

    if (!this.active) {
      if (strongEffort) {
        this.activationTimer += deltaSec;
      } else {
        this.activationTimer = 0;
      }

      if (this.activationTimer >= this.activationHoldSec) {
        this.active = true;
        this.releaseTimer = 0;
      }
      return this.active;
    }

    if (sustainEffort) {
      this.releaseTimer = 0;
      return true;
    }

    this.releaseTimer += deltaSec;
    if (this.releaseTimer >= this.releaseHoldSec) {
      this.active = false;
      this.activationTimer = 0;
    }

    return this.active;
  }
}

