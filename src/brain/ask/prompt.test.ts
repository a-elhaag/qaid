import { describe, expect, it } from 'vitest';
import { ASK_SYSTEM_PROMPT } from './prompt';

describe('ASK_SYSTEM_PROMPT', () => {
  it('contains the key rules', () => {
    expect(ASK_SYSTEM_PROMPT).toContain('prepares, the accountant decides');
    expect(ASK_SYSTEM_PROMPT).toContain('Never invent numbers');
    expect(ASK_SYSTEM_PROMPT).toContain('call list_clients');
    expect(ASK_SYSTEM_PROMPT).toContain('do not have enough information');
    expect(ASK_SYSTEM_PROMPT).toContain('Arabic or English');
  });
  it('does not force a template footer', () => {
    expect(ASK_SYSTEM_PROMPT).toContain('Do not add template footers');
  });
});
