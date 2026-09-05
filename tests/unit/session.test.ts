import { describe, expect, it } from 'vitest';
import {
  clearMerchantCookie,
  createMerchantCookie,
  isMerchantAuthenticated,
} from '@/server/auth/session';

describe('merchant session cookie', () => {
  it('authenticates a signed cookie and not a cleared one', () => {
    const setCookie = createMerchantCookie();
    const token = setCookie.split(';')[0];
    expect(isMerchantAuthenticated(token)).toBe(true);

    const cleared = clearMerchantCookie();
    expect(cleared).toMatch(/^qr_merchant=; /);
    expect(cleared).toContain('Max-Age=0');
    expect(cleared).toContain('HttpOnly');
    expect(isMerchantAuthenticated(cleared.split(';')[0])).toBe(false);
  });
});
