import { beforeEach, describe, expect, it } from 'vitest';
import {
  ChannelMenuIngestionService,
  type ChannelMenuIngressJob,
  type ChannelMenuQueueClient,
} from '../../server/deliverect/ChannelMenuIngestionService';
import { DeliverectApiClient } from '../../server/deliverect/DeliverectApiClient';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { canonicalizeLocaleTag } from '../i18n/entityTranslations';

class CapturingQueue implements ChannelMenuQueueClient {
  jobs: ChannelMenuIngressJob[] = [];

  async enqueue(job: ChannelMenuIngressJob): Promise<void> {
    this.jobs.push(job);
  }
}

const translatedMenu = {
  menu: 'Main Menu',
  menuId: 'menu-translations',
  menuType: 0,
  channelLinkId: 'channel-translations',
  currency: 'GBP',
  menuTranslations: {
    en_GB: 'Main Menu',
    fr: 'Menu principal',
  },
  descriptionTranslations: {
    fr: 'Menu du magasin',
  },
  categories: [
    {
      _id: 'cat-drinks',
      name: 'Drinks',
      nameTranslations: { fr: 'Boissons' },
      descriptionTranslations: { fr: 'Boissons fraîches' },
      subProducts: ['water', 'meal'],
    },
  ],
  products: {
    water: {
      _id: 'water',
      plu: 'WATER-1',
      name: 'Water',
      description: 'Still water',
      nameTranslations: { fr: 'Eau' },
      descriptionTranslations: { fr: 'Eau plate' },
      price: 125,
      productType: 1,
    },
    meal: {
      _id: 'meal',
      plu: 'MEALDEAL-1',
      name: 'Meal Deal',
      description: 'Choose your items',
      nameTranslations: { fr: 'Formule repas' },
      descriptionTranslations: { fr: 'Choisissez vos articles' },
      price: 500,
      productType: 3,
      subProducts: ['group-drink'],
    },
  },
  modifierGroups: {
    'group-drink': {
      _id: 'group-drink',
      name: 'Choose a drink',
      nameTranslations: { fr: 'Choisissez une boisson' },
      descriptionTranslations: { fr: 'Une boisson incluse' },
      min: 1,
      max: 1,
      subProducts: ['modifier-water'],
    },
  },
  modifiers: {
    'modifier-water': {
      _id: 'modifier-water',
      plu: 'WATER-1',
      referenceId: 'WATER-1',
      name: 'Water',
      description: 'Still water',
      nameTranslations: { fr: 'Eau' },
      descriptionTranslations: { fr: 'Eau plate' },
      price: 0,
    },
  },
  snoozedProducts: {},
};

describe('Deliverect menu translation preservation', () => {
  let queue: CapturingQueue;

  beforeEach(() => {
    setServerRuntimeMode('demo');
    queue = new CapturingQueue();
    ChannelMenuIngestionService.setQueueClient(queue);
  });

  it('normalizes documented translation maps without discarding regional tags', () => {
    expect(canonicalizeLocaleTag('en_GB')).toBe('en-GB');
    expect(canonicalizeLocaleTag('pt-BR')).toBe('pt-BR');

    const parsed = DeliverectApiClient.parseDeliverectMenu(
      translatedMenu,
      true,
      []
    );

    expect(parsed.categories[0].translations?.fr).toEqual({
      name: 'Boissons',
      description: 'Boissons fraîches',
    });
    expect(parsed.products.find((item) => item.plu === 'WATER-1')?.translations?.fr)
      .toEqual({
        name: 'Eau',
        description: 'Eau plate',
      });

    const bundle = parsed.bundleCatalog.bundles.find(
      (item) => item.plu === 'MEALDEAL-1'
    );
    expect(bundle?.translations?.fr).toEqual({
      name: 'Formule repas',
      description: 'Choisissez vos articles',
    });
    expect(bundle?.sections[0].translations?.fr?.name).toBe(
      'Choisissez une boisson'
    );
    expect(bundle?.sections[0].modifiers[0].translations?.fr).toEqual({
      name: 'Eau',
      description: 'Eau plate',
    });
  });

  it('persists menu/category/product translations through the real durable worker path', async () => {
    const tenantId = `tenant-translations-${Date.now()}`;
    const rawBody = JSON.stringify(translatedMenu);

    await ChannelMenuIngestionService.acceptVerifiedMenuPush({
      tenantId,
      payload: translatedMenu,
      rawBody,
    });
    expect(queue.jobs).toHaveLength(1);

    await ChannelMenuIngestionService.processJob(queue.jobs[0]);

    const hosted = await ChannelMenuIngestionService.getLatestNormalizedMenu(
      tenantId,
      'channel-translations',
      'menu-translations'
    );

    expect(hosted?.translations?.['en-GB']?.name).toBe('Main Menu');
    expect(hosted?.translations?.fr).toEqual({
      name: 'Menu principal',
      description: 'Menu du magasin',
    });
    expect(hosted?.categories?.[0]?.translations?.fr?.name).toBe('Boissons');
    expect(
      hosted?.products?.find((item: any) => item.plu === 'WATER-1')?.translations?.fr
        ?.name
    ).toBe('Eau');
    expect(hosted?.bundleCatalog?.bundles?.[0]?.sections?.[0]?.modifiers?.[0]
      ?.translations?.fr?.name).toBe('Eau');
  });
});
