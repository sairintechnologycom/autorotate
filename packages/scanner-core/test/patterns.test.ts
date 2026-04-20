import { describe, it, expect } from 'vitest';
import { classifyVar } from '../src/classifier';
import type { VarRecord } from '../src/types';

describe('Pattern Matching', () => {
  const mockVar = (key: string, value: string | null, type: any = 'plain'): VarRecord => ({
    id: '1', key, value, providerType: type, readableByAttacker: type !== 'sensitive',
    targets: ['production'], projectId: 'p1', projectName: 'Project 1'
  });

  it('detects AWS Access Key ID', () => {
    const v = mockVar('MY_KEY', 'AKIAEXAMPLESAMPLEEX1'); // 20 chars
    const risk = classifyVar(v);
    expect(risk.severity).toBe('critical');
    expect(risk.matches[0].patternId).toBe('aws-access-key');
    expect(risk.matches[0].excerpt).toBe('AKIA…PLEX');
  });

  it('detects AWS Secret Key by name', () => {
    const v = mockVar('AWS_SECRET_ACCESS_KEY', 'some-random-val');
    const risk = classifyVar(v);
    expect(risk.severity).toBe('critical');
    expect(risk.matches[0].patternId).toBe('aws-secret-by-name');
  });

  it('detects GitHub PAT', () => {
    const v = mockVar('GH_TOKEN', 'ghp_EXAMPLETOKENEXAMPLETOKENEXAMPLETOKEN'); // 4 + 36 chars
    const risk = classifyVar(v);
    expect(risk.severity).toBe('critical');
    expect(risk.matches[0].patternId).toBe('gh-pat-classic');
  });

  it('detects Stripe live key', () => {
    const v = mockVar('STRIPE_KEY', 'sk_live_not_a_real_key_but_matches_len'); 
    const risk = classifyVar(v);
    expect(risk.severity).toBe('critical');
    expect(risk.matches[0].patternId).toBe('stripe-live-secret');
  });

  it('detects Stripe test key with medium severity', () => {
    const v = mockVar('STRIPE_KEY', 'sk_test_not_a_real_key_but_matches_len');
    const risk = classifyVar(v);
    expect(risk.severity).toBe('medium');
    expect(risk.matches[0].patternId).toBe('stripe-test-secret');
  });

  it('masks sensitive values correctly', () => {
    const v = mockVar('OPENAI_KEY', 'sk-proj-EXAMPLEDATAEXAMPLEDATAEXAMPLEDATA');
    const risk = classifyVar(v);
    expect(risk.matches[0].excerpt).toBe('sk-p…DATA');
  });

  it('marks unclassified exposed vars as low severity', () => {
    const v = mockVar('PORT', '3000');
    const risk = classifyVar(v);
    expect(risk.severity).toBe('low');
    expect(risk.matches[0].patternId).toBe('unclassified-exposed');
  });

  it('ignores sensitive-type variables', () => {
    const v = mockVar('SECRET', null, 'sensitive');
    const risk = classifyVar(v);
    expect(risk.severity).toBe('info');
    expect(risk.matches).toHaveLength(0);
  });
});
