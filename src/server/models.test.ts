import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { route } from './models';

const KEYS = ['GROQ_API_KEY', 'MODEL_EXTRACT', 'MODEL_CHAT', 'MODEL_VISION'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  process.env.GROQ_API_KEY = 'k';
});
afterEach(() => KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

describe('route', () => {
  it('picks the default model per job', () => {
    expect(route('extract').model).toBe('openai/gpt-oss-120b');
    expect(route('categorise').model).toBe('openai/gpt-oss-120b');
    expect(route('chat').model).toBe('openai/gpt-oss-120b');
    expect(route('draft').model).toBe('openai/gpt-oss-120b');
    expect(route('vision').model).toBe('qwen/qwen3.8-27b');
  });
  it('MODEL_CHAT overrides chat and draft only', () => {
    process.env.MODEL_CHAT = 'other';
    expect(route('chat').model).toBe('other');
    expect(route('draft').model).toBe('other');
    expect(route('extract').model).toBe('openai/gpt-oss-120b');
  });
  it('throws without GROQ_API_KEY', () => {
    delete process.env.GROQ_API_KEY;
    expect(() => route('chat')).toThrow('GROQ_API_KEY');
  });
  it('targets Groq', () => {
    expect(route('vision').baseURL).toBe('https://api.groq.com/openai/v1');
  });
});
