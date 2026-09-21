import type { ProductTagDefinition } from '../../src/commerce/models';

/**
 * Deliverect's documented standard product-tag enums.
 * Live /allAllergens metadata stays authoritative and may add/override entries.
 */
export const DELIVERECT_STANDARD_TAG_NAMES: Record<string, string> = {
  '0': 'UNKNOWN', '1': 'ALCOHOL', '2': 'HALAL', '3': 'KOSHER', '4': 'VEGAN', '5': 'VEGETARIAN',
  '6': 'CAN_SERVE_ALONE', '7': 'BOTTLE_DEPOSIT', '8': 'ORGANIC', '9': 'NATURAL', '10': 'SOFT_DRINK',
  '11': 'KETO', '12': 'PALEO', '13': 'PLANT_BASED', '14': 'HFSS', '15': 'TOBACCO',
  '16': 'BABY_NURSING_AND_FEEDING', '17': 'PREPARED_FOOD', '18': 'PREPACKAGED_FOOD', '19': 'TPP_GOOD',
  '20': 'MILK_COCOA', '21': 'BOTTLED_COFFEE_DRINK', '22': 'BOTTLED_TEA_DRINK', '23': 'PREPARED_DRINK',
  '24': 'ENERGY_BEVERAGE', '25': 'NONCARB_UNFLV_UNSW_T_WATER', '26': 'NONCARB_FLV_SWT_WATER',
  '27': 'CARB_UNFLV_UNSW_T_WATER', '28': 'CARB_FLV_SWT_WATER', '29': 'JUICE_100PCT',
  '30': 'UNHEATED_SANDWICH_WRAP', '31': 'CANDY', '32': 'PREPACKAGED_SNACK',
  '33': 'PREPACKAGED_ICE_CREAM', '34': 'SCOOPED_ICE_CREAM', '35': 'BAKERY_ITEM',
  '36': 'CIGARETTES', '37': 'CIGARS', '38': 'E_CIGARETTE', '39': 'VAPES', '40': 'SMOKELESS_TOBACCO',
  '41': 'JUICE_70TO99PCT', '42': 'JUICE_50TO69PCT', '43': 'JUICE_25TO49PCT', '44': 'JUICE_5TO24PCT',
  '45': 'JUICE_1TO4PCT', '46': 'SPECIAL_OFFER', '47': 'PREPACKAGED_GROCERY', '48': 'DISPOSABLE_BAGS',
  '49': 'CARB_ENERGY_BEVERAGE', '50': 'FLV_MILK_COCOA',
  '100': 'CELERY', '101': 'GLUTEN', '102': 'CRUSTACEANS', '103': 'FISH', '104': 'EGGS',
  '105': 'LUPIN', '106': 'MILK', '107': 'MOLLUSCS', '108': 'MUSTARD', '109': 'NUTS',
  '110': 'PEANUTS', '111': 'SESAME', '112': 'SOYA', '113': 'SULPHITES', '114': 'ALMONDS',
  '115': 'BARLEY', '116': 'BRAZIL_NUTS', '117': 'CASHEW', '118': 'HAZELNUTS', '119': 'KAMUT',
  '120': 'MACADAMIA', '121': 'OATS', '122': 'PECAN', '123': 'PISTACHIOS', '124': 'RYE',
  '125': 'SPELT', '126': 'WALNUTS', '127': 'WHEAT', '128': 'SUGARED_DRINK', '129': 'DAIRY',
  '130': 'LENTILS', '131': 'QUEENSLAND_NUTS', '132': 'SHELLFISH', '133': 'TREENUTS',
  '134': 'SOURCES_OF_GLUTEN', '420': 'CANNABIS', '500': 'PACKAGING_FEE',
  '1000': 'NO_ALLERGENS', '1101': 'GLUTEN_FREE', '1128': 'SUGAR_FREE', '1129': 'LAC_FREE',
  '2000': 'PARACETAMOL', '2001': 'ASPIRIN', '2002': 'IBUPROFEN', '2003': 'INFANT_FORMULA',
};

const ALLERGEN_IDS = new Set<string>([
  ...Array.from({ length: 28 }, (_, i) => String(100 + i)), // 100..127
  '129','130','131','132','133','134',
]);

function makeDefinition(item: any, fallbackId?: string): ProductTagDefinition | null {
  if (item == null) return null;
  if (typeof item === 'string' || typeof item === 'number') {
    const id = String(fallbackId ?? item);
    const name = fallbackId != null ? String(item) : DELIVERECT_STANDARD_TAG_NAMES[id] || id;
    return id && name ? { id, name, isAllergen: ALLERGEN_IDS.has(id) } : null;
  }
  if (typeof item !== 'object') return null;
  const id = String(item.id ?? item._id ?? item.value ?? item.tagId ?? fallbackId ?? '');
  const name = String(item.name ?? item.label ?? item.title ?? item.code ?? DELIVERECT_STANDARD_TAG_NAMES[id] ?? '');
  if (!id || !name) return null;
  const type = item.type ?? item.category ?? item.group;
  const typeText = String(type ?? '').toLowerCase();
  return {
    id,
    name,
    ...(type ? { type: String(type) } : {}),
    isAllergen: item.isAllergen === true || typeText.includes('allergen') || ALLERGEN_IDS.has(id),
  };
}

function parseObjectMap(raw: Record<string, any>): ProductTagDefinition[] {
  const out: ProductTagDefinition[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const d = makeDefinition({ id: String(value), name: key }); if (d) out.push(d); continue;
    }
    if (typeof value === 'string' && /^\d+$/.test(value) && !/^\d+$/.test(key)) {
      const d = makeDefinition({ id: value, name: key }); if (d) out.push(d); continue;
    }
    if (typeof value === 'string') {
      const d = makeDefinition(value, key); if (d) out.push(d); continue;
    }
    if (value && typeof value === 'object') {
      const d = makeDefinition(value, /^\d+$/.test(key) ? key : undefined); if (d) out.push(d);
    }
  }
  return out;
}

export function normalizeDeliverectTagDefinitions(raw: any): ProductTagDefinition[] {
  const out: ProductTagDefinition[] = [];
  const append = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) { for (const item of value) { const d = makeDefinition(item); if (d) out.push(d); } return; }
    if (typeof value === 'object') out.push(...parseObjectMap(value));
  };
  if (Array.isArray(raw)) append(raw);
  else if (raw && typeof raw === 'object') {
    append(raw.items); append(raw._items); append(raw.tags); append(raw.allergens);
    if (out.length === 0) append(raw);
  }
  return Array.from(new Map(out.filter(d => d.id && d.name).map(d => [String(d.id), d])).values());
}

export function mergeDeliverectTagDefinitions(raw: any): ProductTagDefinition[] {
  const merged = new Map<string, ProductTagDefinition>();
  for (const [id, name] of Object.entries(DELIVERECT_STANDARD_TAG_NAMES)) {
    merged.set(id, { id, name, isAllergen: ALLERGEN_IDS.has(id) });
  }
  for (const d of normalizeDeliverectTagDefinitions(raw)) merged.set(String(d.id), d);
  return Array.from(merged.values()).sort((a,b) => Number(a.id) - Number(b.id));
}
