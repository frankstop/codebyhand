import type { TestCase } from '../../types/schema';

export function formatJsValue(val: unknown): string {
  if (typeof val === 'string') return JSON.stringify(val);
  if (typeof val === 'number') return Object.is(val, -0) ? '0' : String(val);
  if (typeof val === 'boolean' || val === null) return String(val);
  if (Array.isArray(val)) {
    return `[${val.map(formatJsValue).join(', ')}]`;
  }
  if (typeof val === 'object' && val !== null) {
    const entries = Object.entries(val as Record<string, unknown>).map(
      ([k, v]) => `${JSON.stringify(k)}: ${formatJsValue(v)}`
    );
    return entries.length === 0 ? '{}' : `{${entries.join(', ')}}`;
  }
  return String(val);
}

export function tc(
  fnName: string,
  args: unknown[],
  expected: unknown,
  hidden = false
): TestCase {
  const normalizedExpected = typeof expected === 'number' && expected === 0 ? 0 : expected;
  const call = `${fnName}(${args.map(formatJsValue).join(', ')})`;
  const expectedDisplay = formatJsValue(normalizedExpected);
  return hidden
    ? { call, expectedDisplay, args, expected: normalizedExpected, hidden: true }
    : { call, expectedDisplay, args, expected: normalizedExpected };
}
