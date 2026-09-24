import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { redactOrderProjectionMetadata } from '../../server/firestoreService';

describe('WP-09 order projection PII minimisation', () => {
  it('removes nested customer contact fields while preserving operational metadata', () => {
    const redacted = redactOrderProjectionMetadata({
      paymentMethod: 'CARD',
      customerEmail: 'person@example.test',
      phone: '+44 7000 000000',
      nested: {
        safeFlag: true,
        deliveryAddress: {
          line1: '1 Private Street',
          postcode: 'SW1A 1AA',
        },
        providerReference: 'provider-ref-1',
      },
      list: [
        {
          customerName: 'Private Person',
          status: 'PICKED',
        },
      ],
    }) as any;

    expect(redacted).toEqual({
      paymentMethod: 'CARD',
      nested: {
        safeFlag: true,
        providerReference: 'provider-ref-1',
      },
      list: [
        {
          status: 'PICKED',
        },
      ],
    });
    expect(JSON.stringify(redacted)).not.toContain('person@example.test');
    expect(JSON.stringify(redacted)).not.toContain('1 Private Street');
    expect(JSON.stringify(redacted)).not.toContain('Private Person');
  });

  it('routes arbitrary provider metadata through the redactor before persistence', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'server/firestoreService.ts'),
      'utf8'
    );

    expect(source).toContain(
      '...redactOrderProjectionMetadata((order as any).metadata || {})'
    );
    expect(source).toContain('destinationArea');
    expect(source).not.toContain('customerEmail?:');
    expect(source).not.toContain('customerPhone?:');
  });
});
