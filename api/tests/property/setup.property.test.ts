import * as fc from 'fast-check';

describe('Property-Based Test Setup Verification', () => {
  it('should run a basic property test with fast-check', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
      { numRuns: 100 }
    );
  });

  it('should support string generators', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(s.length).toBeGreaterThanOrEqual(0);
        expect(typeof s).toBe('string');
      }),
      { numRuns: 100 }
    );
  });
});
