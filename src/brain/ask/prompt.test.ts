import { describe, expect, it } from 'vitest';
import { ASK_SYSTEM_PROMPT } from './prompt';

describe('ASK_SYSTEM_PROMPT', () => {
  it('contains the key rules', () => {
    expect(ASK_SYSTEM_PROMPT).toContain('prepares, the accountant decides');
    expect(ASK_SYSTEM_PROMPT).toContain('Never compute or guess numbers');
    expect(ASK_SYSTEM_PROMPT).toContain('name the client and the month');
    expect(ASK_SYSTEM_PROMPT).toContain('do not have enough information');
    expect(ASK_SYSTEM_PROMPT).toContain('Arabic or English');
  });
});
