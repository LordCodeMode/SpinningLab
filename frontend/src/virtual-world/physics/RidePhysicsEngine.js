export const ridePhysicsDefaults = {
  riderWeightKg: 75,
  bikeWeightKg: 9,
  cda: 0.32,
  crr: 0.004,
  airDensity: 1.225,
  drivetrainEfficiency: 0.97,
};

const G = 9.81;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class RidePhysicsEngine {
  constructor(params = {}) {
    this.params = { ...ridePhysicsDefaults, ...params };
    this.speedMps = 0;
  }

  setParams(nextParams = {}) {
    this.params = { ...this.params, ...nextParams };
  }

  reset(initialSpeedKph = 0) {
    this.speedMps = Math.max(0, Number(initialSpeedKph) / 3.6 || 0);
  }

  step({ dt = 0.1, powerW = 0, cadenceRpm = 0, grade = 0 } = {}) {
    const deltaT = clamp(Number(dt) || 0.1, 0.04, 0.5);
    const safeGrade = clamp(Number(grade) || 0, -0.2, 0.2);
    const mass = Math.max(1, (Number(this.params.riderWeightKg) || 0) + (Number(this.params.bikeWeightKg) || 0));
    const crr = Math.max(0.001, Number(this.params.crr) || ridePhysicsDefaults.crr);
    const cda = Math.max(0.05, Number(this.params.cda) || ridePhysicsDefaults.cda);
    const airDensity = Math.max(0.5, Number(this.params.airDensity) || ridePhysicsDefaults.airDensity);
    const efficiency = clamp(Number(this.params.drivetrainEfficiency) || ridePhysicsDefaults.drivetrainEfficiency, 0.5, 1);

    const currentSpeed = Math.max(0.5, this.speedMps);
    const effectivePower = Math.max(0, Number(powerW) || 0) * efficiency;
    const propulsiveForceN = effectivePower / currentSpeed;

    const rollingForceN = mass * G * crr;
    const gravityForceN = mass * G * safeGrade;
    const aeroForceN = 0.5 * airDensity * cda * currentSpeed * currentSpeed;
    const resistiveForceN = rollingForceN + gravityForceN + aeroForceN;

    let accelerationMps2 = (propulsiveForceN - resistiveForceN) / mass;

    if ((Number(cadenceRpm) || 0) < 25 && effectivePower < 40) {
      accelerationMps2 -= 0.15;
    }

    this.speedMps = Math.max(0, this.speedMps + accelerationMps2 * deltaT);

    return {
      speedMps: this.speedMps,
      speedKph: this.speedMps * 3.6,
      accelerationMps2,
      propulsiveForceN,
      resistiveForceN,
    };
  }
}

export default RidePhysicsEngine;
