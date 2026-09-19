import { RetailRule } from './types';

/**
 * Declarative retail rules provided by the Backend-for-Frontend (BFF)
 * as part of tenant and country configuration.
 *
 * NOTE: The UI is advisory only. In a production system, the BFF
 * and Deliverect Commerce API enforce identical rules server-side
 * upon basket mutations and order token creation.
 *
 * Rules never rely on hard-coded product names or Deliverect internal IDs;
 * instead, they map arbitrary tag values, categories, metadata, and attributes
 * to commercial and legal behaviours.
 */
export const DEFAULT_MOCK_RULES: RetailRule[] = [
  // 1. Alcohol Regulatory Compliance (Challenge 25 / 18+ UK/IE)
  {
    id: 'rule-alcohol-licensing-18',
    name: 'Alcoholic Beverages Licensing & Age Verification',
    description: 'Enforces 18+ age restriction, courier physical verification, and advisory warning.',
    enabled: true,
    priority: 100,
    conditions: {
      isAlcoholic: true,
      minAbv: 0.5,
    },
    actions: {
      minimumAge: 18,
      requiresAgeGate: true,
      requiresAgeAcknowledgement: true,
      requiresCourierAgeCheck: true,
      badge: '18+',
      warningText: 'Age restricted: You must be 18 or older. Courier will check photo ID on delivery (Challenge 25).',
    },
  },

  // 2. Tag-based Alcohol fallback rule (e.g. when tagged AGE_RESTRICTED_18)
  {
    id: 'rule-age-restricted-tag-18',
    name: 'Age 18 Restricted Product Tag',
    description: 'Enforces 18+ requirement for tagged items such as tobacco or blades.',
    enabled: true,
    priority: 90,
    conditions: {
      productTags: ['AGE_RESTRICTED_18'],
    },
    actions: {
      minimumAge: 18,
      requiresAgeGate: true,
      requiresAgeAcknowledgement: true,
      requiresCourierAgeCheck: true,
      badge: '18+',
      warningText: 'Must be 18+ to purchase. Challenge 25 verification on delivery.',
    },
  },

  // 3. Age 16 Restricted Items (e.g. paracetamol, energy drinks in specific countries)
  {
    id: 'rule-age-restricted-tag-16',
    name: 'Age 16 Restricted Tagged Items',
    description: 'Enforces age 16 requirement for over-the-counter pharmaceuticals and high-caffeine beverages.',
    enabled: true,
    priority: 85,
    conditions: {
      productTags: ['AGE_RESTRICTED_16'],
    },
    actions: {
      minimumAge: 16,
      requiresAgeGate: false,
      requiresAgeAcknowledgement: true,
      badge: '16+',
      warningText: 'You must be 16 or over to purchase this item.',
    },
  },

  // 4. Group Limit for Over-the-Counter Analgesics (e.g. Medicines Act / MHRA limit)
  // Ensures combined quantity of Paracetamol, Aspirin, and Ibuprofen across the basket <= 2
  {
    id: 'rule-medicine-group-limit',
    name: 'Analgesics Group Limit (Max 2 Combined Packets)',
    description: 'Limits customer purchases across all pain-relief medicines to at most 2 packets total.',
    enabled: true,
    priority: 95,
    conditions: {
      productTags: ['MEDICINE_LIMIT', 'MEDICINE_LIMIT_GROUP'],
    },
    actions: {
      maxQuantityPerProduct: 2,
      maxQuantityAcrossRuleGroup: {
        groupId: 'MEDICINE_LIMIT_GROUP',
        maxQuantity: 2,
        groupName: 'Pain Relief Medication',
      },
      badge: 'Limit 2',
      warningText: 'UK regulations limit orders to a maximum of 2 packets of pain relief across your entire basket.',
    },
  },

  // 5. HFSS (High in Fat, Sugar, Salt) & Upsell Prevention
  // Regulatory rule: Prevents checkout upsell placements, recommendation carousels, or impulse banners
  {
    id: 'rule-hfss-upsell-restriction',
    name: 'HFSS Food Promotion & Upsell Restrictions',
    description: 'Prevents high fat/sugar items from appearing in checkout upsells or promotional recommendation slots.',
    enabled: true,
    priority: 80,
    conditions: {
      productTags: ['HFSS'],
      metadata: {
        hfssRestricted: true,
      },
    },
    actions: {
      preventCheckoutUpsell: true,
      preventRecommendation: true,
      badge: 'HFSS',
    },
  },

  // 6. Bulk Promotion Minimum Quantity Rule (e.g. bulk pack items)
  {
    id: 'rule-bulk-essentials-min-qty',
    name: 'Bulk Essentials Minimum Quantity',
    description: 'Requires a minimum purchase quantity of 2 for wholesale/bulk tagged items.',
    enabled: true,
    priority: 50,
    conditions: {
      productTags: ['BULK_BUY'],
    },
    actions: {
      minimumQuantity: 2,
      warningText: 'Promotional item: Minimum 2 packs required for this deal.',
    },
  },

  // 7. Allergen Prominence Rule for Bakery and Fresh Prepared Food
  {
    id: 'rule-fresh-prepared-allergens',
    name: 'Fresh Prepared Food Mandatory Allergen Display',
    description: 'Ensures allergen sections are rendered prominently on freshly prepared goods (Natasha’s Law).',
    enabled: true,
    priority: 60,
    conditions: {
      category: ['cat-fresh-bakery', 'cat-meals-pizza'],
    },
    actions: {
      requiresAllergenDisplay: true,
    },
  },

  // 8. Delivery-only or Collection-only Restriction Example
  {
    id: 'rule-fragile-chilled-delivery-only',
    name: 'Fragile Chilled Goods Courier Fulfilment',
    description: 'Prevents pickup for items that require immediate courier cold-chain compliance if applicable.',
    enabled: false, // Disabled by default, can be toggled by tenant
    priority: 40,
    conditions: {
      productTags: ['COLD_CHAIN_MANDATORY'],
      fulfillmentType: 'pickup',
    },
    actions: {
      preventPurchase: true,
      warningText: 'This temperature-controlled item is only available for rapid courier delivery.',
    },
  },
];
