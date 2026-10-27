import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAuthDisabled, isAuthenticated, SESSION_COOKIE, signSession } from './auth';
import { guardRequest } from './api-guard';
import { GET as status } from '@/app/api/status/route';
import { GET as authStatus, POST as login } from '@/app/api/auth/route';
import { GET as proxy } from '@/app/api/proxy/route';

afterEach(() => vi.unstubAllEnvs());

function configure(authDisabled: string | undefined, password: string | null = 'test-password') {
  vi.stubEnv('AUTH_DISABLED', authDisabled);
  vi.stubEnv('PASSWORD', password ?? undefined);
}

describe('private-network access mode', () => {
  it.each([undefined, '', 'false', '0', '1', 'TRUE'])('does not disable login for %s', (value) => {
    configure(value);
    expect(isAuthDisabled()).toBe(false);
    expect(isAuthenticated(null)).toBe(false);
    expect(guardRequest(new Request('http://localhost/api/search'))?.status).toBe(401);
  });

  it('retains signed-cookie access when password authentication is enabled', () => {
    configure(undefined);
    const { token } = signSession();
    expect(guardRequest(new Request('http://localhost/api/search', {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }))).toBeNull();
  });

  it('still requires administrator setup without a password in the default mode', async () => {
    configure(undefined, null);
    const request = new Request('http://localhost/api/status');
    expect(guardRequest(request)?.status).toBe(503);
    expect(await (await status(request)).json()).toMatchObject({
      passwordRequired: false, authDisabled: false, verified: false,
    });
  });

  it('allows fresh clients without a password or session after explicit opt-in', async () => {
    configure('true', null);
    const request = new Request('http://localhost/api/status');
    expect(isAuthenticated(null)).toBe(true);
    expect(guardRequest(request)).toBeNull();
    expect(await (await status(request)).json()).toMatchObject({
      passwordRequired: false, authDisabled: true, verified: true,
    });
    expect(await (await authStatus(request)).json()).toMatchObject({ verified: true });
    const response = await login(new Request('http://localhost/api/auth', { method: 'POST' }));
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('keeps SSRF protection active without login', async () => {
    configure('true', null);
    const response = await proxy(new Request('http://localhost/api/proxy?url=http%3A%2F%2F127.0.0.1%2F'));
    expect(response.status).toBe(400);
  });

  it('requires authentication again when the opt-in is removed', async () => {
    configure('true');
    expect(guardRequest(new Request('http://localhost/api/search'))).toBeNull();
    vi.stubEnv('AUTH_DISABLED', 'false');
    const request = new Request('http://localhost/api/status');
    expect(guardRequest(request)?.status).toBe(401);
    expect(await (await status(request)).json()).toMatchObject({ authDisabled: false, verified: false });
  });
});
