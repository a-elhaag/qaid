import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { route } from './models';

const KEYS = ['FOUNDRY_RESOURCE', 'FOUNDRY_API_KEY', 'MODEL_EXTRACT', 'MODEL_CHAT', 'MODEL_PARSE'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  process.env.FOUNDRY_RESOURCE = 'qaid';
  process.env.FOUNDRY_API_KEY = 'k';
});
afterEach(() => KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

describe('route', () => {
  it('picks the default model per job', () => {
    expect(route('extract').model).toBe('gpt-6.1-sol');
    expect(route('categorise').model).toBe('gpt-6.1-sol');
    expect(route('chat').model).toBe('gpt-6-astra');
    expect(route('draft').model).toBe('gpt-6-astra');
    expect(route('parse').model).toBe('cohere-parse-v5');
  });
  it('MODEL_CHAT overrides chat and draft only', () => {
    process.env.MODEL_CHAT = 'other';
    expect(route('chat').model).toBe('other');
    expect(route('draft').model).toBe('other');
    expect(route('extract').model).toBe('gpt-6.1-sol');
  });
  it('throws without FOUNDRY_RESOURCE', () => {
    delete process.env.FOUNDRY_RESOURCE;
    expect(() => route('chat')).toThrow('FOUNDRY_RESOURCE');
  });
  it('hosts contain the resource name', () => {
    const r = route('parse');
    expect(r.openaiBaseURL).toContain('qaid.openai.azure.com');
    expect(r.cohereBaseURL).toContain('qaid.services.ai.azure.com');
  });
});
