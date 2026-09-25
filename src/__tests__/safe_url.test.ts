import { describe, expect, it } from 'vitest';
import { safeHttpsUrl } from '../utils/safeUrl';

describe('safeHttpsUrl', () => {
  it('allows HTTPS courier links and rejects executable or insecure schemes', () => {
    expect(safeHttpsUrl('https://courier.example.test/track/123')).toBe(
      'https://courier.example.test/track/123'
    );
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('http://courier.example.test/track/123')).toBeNull();
    expect(safeHttpsUrl('not a url')).toBeNull();
  });
});
