import { describe, it, expect } from 'vitest';
import { createBridgeEnvelope } from '../src/virtual-world/bridge.js';

describe('createBridgeEnvelope', () => {
  it('serializes payloads into Unity-compatible envelopes', () => {
    const envelope = createBridgeEnvelope('live-data', { power: 250, cadence: 91 });

    expect(envelope.type).toBe('live-data');
    expect(typeof envelope.dataJson).toBe('string');
    expect(JSON.parse(envelope.dataJson)).toEqual({ power: 250, cadence: 91 });
  });

  it('falls back to empty json for unserializable payloads', () => {
    const payload = {};
    payload.self = payload;

    const envelope = createBridgeEnvelope('live-data', payload);

    expect(envelope.type).toBe('live-data');
    expect(envelope.dataJson).toBe('{}');
  });
});
