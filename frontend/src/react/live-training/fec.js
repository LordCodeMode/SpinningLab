const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toUint8Array = (input) => {
  if (!input) return null;
  if (input instanceof Uint8Array) return input;
  if (input instanceof DataView) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return null;
};

const writeUInt16LE = (buffer, offset, value) => {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
};

const readUInt16LE = (buffer, offset) => (
  buffer[offset] | (buffer[offset + 1] << 8)
);

const applyDefinition = (field, value) => {
  const fallback = field.default ?? 0;
  const resolution = field.resolution ?? 1;
  const offset = field.offset ?? 0;
  const raw = value ?? fallback;
  const scaled = (raw / resolution) + (offset / resolution);
  return Math.round(scaled);
};

const getBits = (start, length, value) => {
  const mask = (1 << length) - 1;
  return (value >> start) & mask;
};

const encodeDataPage49 = (payload = {}) => {
  const buffer = new Uint8Array(8);
  const power = clamp(applyDefinition({ default: 0, resolution: 0.25 }, payload.power), 0, 0xffff);
  buffer[0] = 49;
  writeUInt16LE(buffer, 6, power);
  return buffer;
};

const encodeDataPage50 = (payload = {}) => {
  const buffer = new Uint8Array(8);
  const windResistance = clamp(
    applyDefinition({ default: 0.51, resolution: 0.01 }, payload.windResistance),
    0,
    255
  );
  const windSpeed = clamp(
    applyDefinition({ default: 0, resolution: 1, offset: 127 }, payload.windSpeed),
    0,
    255
  );
  const draftingFactor = clamp(
    applyDefinition({ default: 1.0, resolution: 0.01 }, payload.draftingFactor),
    0,
    255
  );
  buffer[0] = 50;
  buffer[5] = windResistance;
  buffer[6] = windSpeed;
  buffer[7] = draftingFactor;
  return buffer;
};

const encodeDataPage55 = (payload = {}) => {
  const buffer = new Uint8Array(8);
  const userWeight = clamp(
    applyDefinition({ default: 75, resolution: 0.01 }, payload.userWeight),
    0,
    0xffff
  );
  const diameterOffset = clamp(
    applyDefinition({ default: 0x0f, resolution: 1 }, payload.diameterOffset),
    0,
    0x0f
  );
  const bikeWeight = clamp(
    applyDefinition({ default: 8, resolution: 0.05 }, payload.bikeWeight),
    0,
    0x0fff
  );
  const wheelDiameter = clamp(
    applyDefinition({ default: 0.7, resolution: 0.01 }, payload.wheelDiameter),
    0,
    0xff
  );
  const gearRatio = clamp(
    applyDefinition({ default: 0, resolution: 0.03 }, payload.gearRatio),
    0,
    0xff
  );

  const combined1 = (getBits(0, 4, bikeWeight) << 4) + diameterOffset;
  const bikeWeightMsb = (bikeWeight >> 4) & 0xff;

  buffer[0] = 55;
  writeUInt16LE(buffer, 1, userWeight);
  buffer[4] = combined1;
  buffer[5] = bikeWeightMsb;
  buffer[6] = wheelDiameter;
  buffer[7] = gearRatio;
  return buffer;
};

const encodeDataPage = (dataPage, payload = {}) => {
  switch (Number(dataPage)) {
    case 49:
      return encodeDataPage49(payload);
    case 50:
      return encodeDataPage50(payload);
    case 55:
      return encodeDataPage55(payload);
    default:
      return null;
  }
};

const decodeDataPage25 = (buffer, start = 4) => {
  if (!buffer || buffer.length < start + 8) return null;
  const cadence = buffer[start + 2];
  const combined = readUInt16LE(buffer, start + 5);
  const power = combined & 0x0fff;
  return { dataPage: 25, cadence, power };
};

const decodeDataPage = (dataPage, buffer, start = 4) => {
  switch (Number(dataPage)) {
    case 25:
      return decodeDataPage25(buffer, start);
    default:
      return null;
  }
};

const SYNC = 0xa4;
const LENGTH = 0x09;
const MSG_ACK = 0x4f;
const DEFAULT_CHANNEL = 0x05;

const computeChecksum = (buffer, length = buffer.length) => {
  let checksum = 0;
  for (let i = 0; i < length; i += 1) {
    checksum ^= buffer[i];
  }
  return checksum;
};

const buildFecMessage = (dataPage, payload, options = {}) => {
  const channel = Number.isFinite(options.channel) ? options.channel : DEFAULT_CHANNEL;
  const msgId = Number.isFinite(options.msgId) ? options.msgId : MSG_ACK;
  const pagePayload = encodeDataPage(dataPage, payload);
  if (!pagePayload) {
    throw new Error(`Unsupported FEC data page ${dataPage}.`);
  }

  const buffer = new Uint8Array(4 + LENGTH);
  buffer[0] = SYNC;
  buffer[1] = LENGTH;
  buffer[2] = msgId;
  buffer[3] = channel & 0xff;
  buffer.set(pagePayload, 4);
  buffer[buffer.length - 1] = computeChecksum(buffer, buffer.length - 1);
  return buffer;
};

const parseFecMessage = (input) => {
  const buffer = toUint8Array(input);
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] !== SYNC) return null;
  const length = buffer[1];
  const msgId = buffer[2];
  if (buffer.length < length + 4) return null;
  const checksum = buffer[3 + length];
  const expected = computeChecksum(buffer, 3 + length);
  if (checksum !== expected) return null;

  const payload = buffer.slice(3, 3 + length);
  const channel = payload[0];
  const dataPage = payload[1];
  const decoded = decodeDataPage(dataPage, buffer, 4);

  return {
    msgId,
    channel,
    dataPage,
    payload,
    decoded
  };
};

export {
  buildFecMessage,
  parseFecMessage
};
