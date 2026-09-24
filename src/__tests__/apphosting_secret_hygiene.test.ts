import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('App Hosting privileged configuration hygiene', () => {
  it('does not commit a plaintext platform SuperAdmin allowlist', () => {
    const config = read('apphosting.yaml');

    expect(config).not.toMatch(/^\s*-\s*variable:\s*PLATFORM_SUPERADMIN_EMAILS\s*$/m);
    expect(config).not.toMatch(/PLATFORM_SUPERADMIN_EMAILS\s*=\s*[^\s#]+/);
  });

  it('keeps the bootstrap allowlist behind the server Secret Manager boundary', () => {
    const firebase = read('server/firebase.ts');

    expect(firebase).toContain("SecretManager.getSecret('PLATFORM_SUPERADMIN_EMAILS')");
    expect(firebase).not.toContain('process.env.PLATFORM_SUPERADMIN_EMAILS');
  });
});
