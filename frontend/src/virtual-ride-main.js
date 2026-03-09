const channel = new BroadcastChannel('virtual-ride-data');

const fields = {
  power: document.getElementById('power'),
  cadence: document.getElementById('cadence'),
  heartRate: document.getElementById('heartRate'),
  speed: document.getElementById('speed'),
  grade: document.getElementById('grade'),
  distance: document.getElementById('distance')
};

const format = {
  power: (value) => `${Math.round(Number(value) || 0)} W`,
  cadence: (value) => `${Math.round(Number(value) || 0)} rpm`,
  heartRate: (value) => `${Math.round(Number(value) || 0)} bpm`,
  speed: (value) => `${(Number(value) || 0).toFixed(1)} km/h`,
  grade: (value) => `${(Number(value) || 0).toFixed(1)} %`,
  distance: (value) => `${((Number(value) || 0) / 1000).toFixed(2)} km`
};

const renderLiveData = (data = {}) => {
  fields.power.textContent = format.power(data.power);
  fields.cadence.textContent = format.cadence(data.cadence);
  fields.heartRate.textContent = format.heartRate(data.heartRate);
  fields.speed.textContent = format.speed(data.virtualSpeedKph || data.speed);
  fields.grade.textContent = format.grade(data.routeGradePct);
  fields.distance.textContent = format.distance(data.distance);
};

channel.onmessage = (event) => {
  const message = event?.data || {};
  if (message.type === 'live-data') {
    renderLiveData(message.data || {});
  }
};

channel.postMessage({
  type: 'virtual-world-ready',
  data: {
    runtime: 'three',
    reason: 'fallback-runtime'
  }
});

window.addEventListener('beforeunload', () => channel.close());
