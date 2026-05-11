import { ValidationError, NotFoundError } from '@/utils/errors';

describe('Test Setup Verification', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should resolve path aliases (@/*)', () => {
    expect(ValidationError).toBeDefined();
    expect(NotFoundError).toBeDefined();
  });

  it('should support TypeScript features', () => {
    interface TestType {
      name: string;
      value: number;
    }

    const obj: TestType = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(42);
  });
});
