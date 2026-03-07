export const ridePhysicsDefaults = {
  riderWeightKg: 75,
  bikeWeightKg: 9,
  cda: 0.32,
  crr: 0.004,
  airDensity: 1.225,
  drivetrainEfficiency: 0.97,
  maxGrade: 0.12
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

  setSpeedKph(speedKph = 0) {
    this.speedMps = Math.max(0, Number(speedKph) / 3.6 || 0);
  }

  step({ dt = 0.1, powerW = 0, cadenceRpm = 0, grade = 0 } = {}) {
    const deltaT = clamp(Number(dt) || 0.1, 0.04, 0.5);
    const maxGrade = Math.max(0.02, Number(this.params.maxGrade) || ridePhysicsDefaults.maxGrade);
    const safeGrade = clamp(Number(grade) || 0, -maxGrade, maxGrade);
    const mass = Math.max(1, (Number(this.params.riderWeightKg) || 0) + (Number(this.params.bikeWeightKg) || 0));
    const crr = Math.max(0.001, Number(this.params.crr) || ridePhysicsDefaults.crr);
    const cda = Math.max(0.05, Number(this.params.cda) || ridePhysicsDefaults.cda);
    const airDensity = Math.max(0.5, Number(this.params.airDensity) || ridePhysicsDefaults.airDensity);
    const efficiency = clamp(Number(this.params.drivetrainEfficiency) || ridePhysicsDefaults.drivetrainEfficiency, 0.5, 1);
    const cadence = Math.max(0, Number(cadenceRpm) || 0);

    const currentSpeed = Math.max(0, this.speedMps);
    const driveSpeed = Math.max(1.4, currentSpeed);
    const effectivePower = Math.max(0, Number(powerW) || 0) * efficiency;
    const cadenceDriveFactor = clamp((cadence - 18) / 75, 0, 1);
    const maxPropulsiveForceN = 260 + cadenceDriveFactor * 420 + clamp(effectivePower / 4, 0, 180);
    const propulsiveForceN = clamp(effectivePower / driveSpeed, 0, maxPropulsiveForceN);

    const rollingForceN = mass * G * crr * Math.cos(Math.atan(safeGrade));
    const gravityForceN = mass * G * safeGrade;
    const aeroForceN = 0.5 * airDensity * cda * currentSpeed * currentSpeed;
    const resistiveForceN = rollingForceN + gravityForceN + aeroForceN;

    let accelerationMps2 = (propulsiveForceN - resistiveForceN) / mass;
    if (currentSpeed < 1.8 && cadence >= 18 && effectivePower >= 85) {
      const lowSpeedFactor = 1 - clamp(currentSpeed / 1.8, 0, 1);
      const cadenceFactor = clamp((cadence - 18) / 60, 0, 1);
      accelerationMps2 += 1.0 * lowSpeedFactor * cadenceFactor;
    }

    if (cadence < 25 && effectivePower < 40) {
      accelerationMps2 -= 0.12;
    }

    accelerationMps2 = clamp(accelerationMps2, -6, 4.5);
    this.speedMps = Math.max(0, this.speedMps + accelerationMps2 * deltaT);
    if (this.speedMps < 0.03) {
      this.speedMps = 0;
    }

    return {
      speedMps: this.speedMps,
      speedKph: this.speedMps * 3.6,
      grade: safeGrade,
      cadenceRpm: cadence,
      effectivePowerW: effectivePower,
      accelerationMps2,
      propulsiveForceN,
      resistiveForceN
    };
  }
}

export default RidePhysicsEngine;
