import { CmsPage } from './cmsModels';

export const MOCK_CMS_PAGES: Record<string, CmsPage[]> = {
  'brand-alpha': [
    {
      id: 'page-about',
      tenantId: 'brand-alpha',
      slug: 'about-our-growers',
      title: 'About Our Local Growers & Farms',
      seoTitle: 'Our Heritage & Local Farms | Chelmsford Artisan Grocer',
      seoDescription: 'Discover our partner regenerative farms across Essex providing fresh daily produce and dairy.',
      locale: 'en-GB',
      status: 'published',
      publishDate: '2026-03-01T00:00:00Z',
      navigationVisibility: 'both',
      blocks: [
        {
          id: 'b1',
          type: 'Hero',
          order: 1,
          headline: 'From Soil to Doorstep in Hours',
          subheadline: 'Partnering directly with local Essex family estates and slow-ferment heritage bakeries.',
          badge: 'Regenerative Agriculture',
          imageUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&auto=format&fit=crop&q=80',
          ctaText: 'Explore Farm Essentials',
        },
        {
          id: 'b2',
          type: 'RichText',
          order: 2,
          content: 'Every morning at 4:30 AM, our delivery vans collect freshly stoneground loaves and chilled raw jersey dairy directly from farm gates in Great Waltham and Danbury.\n\nBy keeping our supply loops hyper-local, we cut cold-chain emissions by 72% while guaranteeing crisp produce picked hours before arrival.',
        },
        {
          id: 'b3',
          type: 'ProductCarousel',
          order: 3,
          title: 'Farm Gate Daily Picks',
          subtitle: 'Harvested this morning from local certified organic growers',
          productPlus: ['PLU-SOURDOUGH-01', 'PLU-ORGANIC-EGGS-6PK', 'PLU-ORGANIC-MILK-2L'],
        },
        {
          id: 'b4',
          type: 'StoreFinder',
          order: 4,
          title: 'Visit Our Artisan Dispatch Hubs',
          description: 'Experience in-store bakery milling and fresh juice pressing in person.',
        },
        {
          id: 'b5',
          type: 'FAQ',
          order: 5,
          title: 'Frequently Asked Questions',
          items: [
            {
              question: 'How do you guarantee freshness on morning delivery?',
              answer: 'Our inventory is picked live in-store by trained produce specialists within 15 minutes of scheduled dispatch.',
            },
            {
              question: 'How does the Lower Price Guarantee work on substitutions?',
              answer: 'If an item is unavailable and an alternative is chosen, you never pay more than the original ordered shelf price.',
            },
            {
              question: 'Can I return delivery bags and bottle deposits?',
              answer: 'Yes! Hand back bottles and crates to your courier on their next visit for instant account credit under our DRS scheme.',
            },
          ],
        },
      ],
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-05T14:30:00Z',
    },
    {
      id: 'page-terms',
      tenantId: 'brand-alpha',
      slug: 'terms-and-guarantees',
      title: 'Terms of Service & Price Guarantee',
      seoTitle: 'Terms & Freshness Guarantee | Chelmsford Artisan Grocer',
      seoDescription: 'Review our store policies, Best-Match Price Guarantee, and delivery terms.',
      locale: 'en-GB',
      status: 'published',
      publishDate: '2026-03-01T00:00:00Z',
      navigationVisibility: 'footer',
      blocks: [
        {
          id: 'b201',
          type: 'Hero',
          order: 1,
          headline: 'Our Fair Price & Quality Guarantee',
          subheadline: 'Transparent pricing, no hidden markups, and strict cold-chain compliance.',
          badge: 'Customer Charter',
        },
        {
          id: 'b202',
          type: 'RichText',
          order: 2,
          content: '### Lower Price Guarantee\nWhen an item is substituted during picking, you are automatically charged the lower of the two prices. You never pay extra for a replacement, even if we substitute an organic or premium alternative.\n\n### Authoritative Payment Flow\nPayments are pre-authorised with a safety margin (default 15%) to account for potential weighted produce variations, and settled strictly upon picking completion for the exact items packed.',
        },
      ],
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-05T14:30:00Z',
    },
  ],
};

export const DEFAULT_MOCK_PAGES: CmsPage[] = MOCK_CMS_PAGES['brand-alpha'];
