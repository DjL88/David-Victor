import { describe, expect, it } from 'vitest';
import { mergeStoreServices } from '../../server/deliverect/DeliverectApiClient';

describe('store marketplace service projection', () => {
  it('keeps the Commerce store channel and the physical location marketplaces', () => {
    const merged = mergeStoreServices(
      [{ id: 'leitch', name: 'LeitchTech', status: 'SUBSCRIBED', source: 'DELIVERECT' }],
      [
        { id: 'deliveroo', name: 'Deliveroo Retail', status: 'SUBSCRIBED', source: 'DELIVERECT' },
        { id: 'uber', name: 'Uber Eats Retail', status: 'ACTIVE', source: 'DELIVERECT' },
      ],
    );

    expect(merged?.map((service) => service.id)).toEqual(['deliveroo', 'uber', 'leitch']);
  });

  it('prefers current Commerce metadata for a duplicate channel link', () => {
    const merged = mergeStoreServices(
      [{ id: 'deliveroo', name: 'Deliveroo current', status: 'ACTIVE', source: 'DELIVERECT' }],
      [{ id: 'deliveroo', name: 'Deliveroo stale', status: 'INACTIVE', source: 'DELIVERECT' }],
    );

    expect(merged).toEqual([
      { id: 'deliveroo', name: 'Deliveroo current', status: 'ACTIVE', source: 'DELIVERECT' },
    ]);
  });
});
