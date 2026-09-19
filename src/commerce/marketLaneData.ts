/**
 * Deliverect Retail Authoritative Mock Dataset: "Market Lane"
 *
 * Sourced directly from Deliverect Commerce API & POS sync specs.
 * Features:
 * - 8 realistic Essex/East Anglia stores with distinct operating states (Open, Busy, Closed)
 * - 10 top-level categories with multi-level subcategory taxonomies
 * - 280+ authoritative products with UK regulatory metadata (Challenge 25 18+ ID, Paracetamol MHRA max 2 limit, Deposit Return Scheme)
 * - Store-specific price variances, localized out-of-stock anomalies, and missing media fallbacks.
 */
import { Store, Category, RootCatalogProduct, StoreProductAvailability } from './models';

export const MARKET_LANE_STORES: Store[] = [
  {
    "id": "store-market-lane-chelmsford",
    "name": "Market Lane — Chelmsford High Street",
    "address": {
      "line1": "42 High Street",
      "city": "Chelmsford",
      "postalCode": "CM1 1BE",
      "country": "GB",
      "formattedAddress": "42 High Street, Chelmsford CM1 1BE"
    },
    "coordinates": {
      "latitude": 51.7356,
      "longitude": 0.4705
    },
    "distanceMeters": 650,
    "status": "open",
    "supportsDelivery": true,
    "supportsPickup": true,
    "collectionAvailable": true,
    "deliveryEta": "15–25 min",
    "deliveryPrice": 1.99,
    "minOrderAmount": 10,
    "locationGroup": "essex-urban",
    "channelLinks": [
      "DIRECT",
      "DELIVEROO",
      "UBER_EATS"
    ],
    "dispatchAvailability": {
      "available": true,
      "validationId": "disp_val_ch101",
      "deliveryEtaMinutes": 20,
      "deliveryPrice": 1.99,
      "pickupEtaMinutes": 10
    }
  },
  {
    "id": "store-market-lane-moulsham",
    "name": "Market Lane — Old Moulsham Grocers",
    "address": {
      "line1": "88 Moulsham Street",
      "city": "Chelmsford",
      "postalCode": "CM2 0JL",
      "country": "GB",
      "formattedAddress": "88 Moulsham Street, Chelmsford CM2 0JL"
    },
    "coordinates": {
      "latitude": 51.7289,
      "longitude": 0.4731
    },
    "distanceMeters": 1200,
    "status": "open",
    "supportsDelivery": true,
    "supportsPickup": true,
    "collectionAvailable": true,
    "deliveryEta": "20–30 min",
    "deliveryPrice": 2.29,
    "minOrderAmount": 12,
    "locationGroup": "essex-urban",
    "channelLinks": [
      "DIRECT",
      "DELIVEROO"
    ],
    "dispatchAvailability": {
      "available": true,
      "validationId": "disp_val_ml202",
      "deliveryEtaMinutes": 25,
      "deliveryPrice": 2.29,
      "pickupEtaMinutes": 12
    }
  },
  {
    "id": "store-market-lane-billericay",
    "name": "Market Lane — Billericay Station Parade",
    "address": {
      "line1": "14 Station Road",
      "city": "Billericay",
      "postalCode": "CM12 9BE",
      "country": "GB",
      "formattedAddress": "14 Station Road, Billericay CM12 9BE"
    },
    "coordinates": {
      "latitude": 51.6288,
      "longitude": 0.4186
    },
    "distanceMeters": 2300,
    "status": "busy",
    "supportsDelivery": false,
    "supportsPickup": true,
    "collectionAvailable": true,
    "deliveryEta": "Delivery temporarily paused",
    "deliveryPrice": 0,
    "minOrderAmount": 5,
    "locationGroup": "essex-commuter",
    "channelLinks": [
      "DIRECT",
      "JUST_EAT"
    ],
    "dispatchAvailability": {
      "available": false,
      "reason": "No dispatch couriers available in immediate sector. Collection ready in 15 mins.",
      "pickupEtaMinutes": 15
    }
  },
  {
    "id": "store-market-lane-brentwood",
    "name": "Market Lane — Brentwood Crown Street",
    "address": {
      "line1": "5 Crown Street",
      "city": "Brentwood",
      "postalCode": "CM14 4AZ",
      "country": "GB",
      "formattedAddress": "5 Crown Street, Brentwood CM14 4AZ"
    },
    "coordinates": {
      "latitude": 51.6198,
      "longitude": 0.3012
    },
    "distanceMeters": 3800,
    "status": "open",
    "supportsDelivery": true,
    "supportsPickup": true,
    "collectionAvailable": true,
    "deliveryEta": "25–35 min",
    "deliveryPrice": 2.49,
    "minOrderAmount": 12,
    "locationGroup": "essex-commuter",
    "channelLinks": [
      "DIRECT",
      "DELIVEROO",
      "UBER_EATS"
    ],
    "dispatchAvailability": {
      "available": true,
      "validationId": "disp_val_bw303",
      "deliveryEtaMinutes": 30,
      "deliveryPrice": 2.49,
      "pickupEtaMinutes": 15
    }
  },
  {
    "id": "store-market-lane-shenfield",
    "name": "Market Lane — Shenfield Broadway",
    "address": {
      "line1": "92 Hutton Road",
      "city": "Shenfield",
      "postalCode": "CM15 8NB",
      "country": "GB",
      "formattedAddress": "92 Hutton Road, Shenfield CM15 8NB"
    },
    "coordinates": {
      "latitude": 51.6321,
      "longitude": 0.3298
    },
    "distanceMeters": 4100,
    "status": "open",
    "supportsDelivery": true,
    "supportsPickup": true,
    "collectionAvailable": true,
    "deliveryEta": "20–30 min",
    "deliveryPrice": 2.29,
    "minOrderAmount": 10,
    "locationGroup": "essex-commuter",
    "channelLinks": [
      "DIRECT",
      "DELIVEROO"
    ],
    "dispatchAvailability": {
      "available": true,
      "validationId": "disp_val_sh404",
      "deliveryEtaMinutes": 25,
      "deliveryPrice": 2.29,
      "pickupEtaMinutes": 10
    }
  },
  {
    "id": "store-market-lane-wickford",
    "name": "Market Lane — Wickford Retail Depot",
    "address": {
      "line1": "Unit 3, Southend Road",
      "city": "Wickford",
      "postalCode": "SS11 8HN",
      "country": "GB",
      "formattedAddress": "Unit 3, Southend Road, Wickford SS11 8HN"
    },
    "coordinates": {
      "latitude": 51.6112,
      "longitude": 0.5218
    },
    "distanceMeters": 4900,
    "status": "closed",
    "supportsDelivery": true,
    "supportsPickup": true,
    "collectionAvailable": false,
    "deliveryEta": "Opens at 07:00 tomorrow",
    "deliveryPrice": 2.99,
    "minOrderAmount": 15,
    "locationGroup": "essex-east",
    "channelLinks": [
      "DIRECT"
    ]
  },
  {
    "id": "store-market-lane-colchester",
    "name": "Market Lane — Colchester Trinity Street",
    "address": {
      "line1": "18 Trinity Street",
      "city": "Colchester",
      "postalCode": "CO1 1JN",
      "country": "GB",
      "formattedAddress": "18 Trinity Street, Colchester CO1 1JN"
    },
    "coordinates": {
      "latitude": 51.8892,
      "longitude": 0.8998
    },
    "distanceMeters": 6200,
    "status": "open",
    "supportsDelivery": true,
    "supportsPickup": true,
    "collectionAvailable": true,
    "deliveryEta": "20–30 min",
    "deliveryPrice": 2.49,
    "minOrderAmount": 10,
    "locationGroup": "essex-north",
    "channelLinks": [
      "DIRECT",
      "DELIVEROO",
      "UBER_EATS",
      "JUST_EAT"
    ],
    "dispatchAvailability": {
      "available": true,
      "validationId": "disp_val_col505",
      "deliveryEtaMinutes": 25,
      "deliveryPrice": 2.49,
      "pickupEtaMinutes": 10
    }
  },
  {
    "id": "store-market-lane-maldon",
    "name": "Market Lane — Maldon Quay & Deli",
    "address": {
      "line1": "74 High Street",
      "city": "Maldon",
      "postalCode": "CM9 5ET",
      "country": "GB",
      "formattedAddress": "74 High Street, Maldon CM9 5ET"
    },
    "coordinates": {
      "latitude": 51.7314,
      "longitude": 0.6802
    },
    "distanceMeters": 5500,
    "status": "open",
    "supportsDelivery": true,
    "supportsPickup": true,
    "collectionAvailable": true,
    "deliveryEta": "25–35 min",
    "deliveryPrice": 2.79,
    "minOrderAmount": 15,
    "locationGroup": "essex-coastal",
    "channelLinks": [
      "DIRECT",
      "DELIVEROO"
    ],
    "dispatchAvailability": {
      "available": true,
      "validationId": "disp_val_mal606",
      "deliveryEtaMinutes": 30,
      "deliveryPrice": 2.79,
      "pickupEtaMinutes": 15
    }
  }
];

export const MARKET_LANE_CATEGORIES: Category[] = [
  {
    "id": "cat-fresh-produce",
    "name": "Fresh Produce",
    "description": "Crisp fruit, organic vegetables, fresh herbs and salads",
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "iconName": "Apple",
    "subcategories": [
      {
        "id": "cat-fruit-berries",
        "name": "Berries, Cherries & Grapes"
      },
      {
        "id": "cat-fruit-citrus",
        "name": "Citrus, Apples & Pears"
      },
      {
        "id": "cat-fruit-tropical",
        "name": "Bananas & Tropical Fruit"
      },
      {
        "id": "cat-veg-salads",
        "name": "Salad, Tomatoes & Cucumbers"
      },
      {
        "id": "cat-veg-roots",
        "name": "Root Vegetables & Potatoes"
      },
      {
        "id": "cat-veg-herbs",
        "name": "Fresh Culinary Herbs"
      }
    ]
  },
  {
    "id": "cat-bakery",
    "name": "Bakery & Bread",
    "description": "Fresh sourdough, morning pastries, artisanal loaves and rolls",
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
    "iconName": "Wheat",
    "subcategories": [
      {
        "id": "cat-bakery-sourdough",
        "name": "Artisan Sourdough & Specialty Loaves"
      },
      {
        "id": "cat-bakery-sliced",
        "name": "Everyday Sliced Bread & Wraps"
      },
      {
        "id": "cat-bakery-pastries",
        "name": "Croissants & Breakfast Pastries"
      },
      {
        "id": "cat-bakery-buns",
        "name": "Brioche, Rolls & Bagels"
      },
      {
        "id": "cat-bakery-sweets",
        "name": "Cakes, Cookies & Brownies"
      }
    ]
  },
  {
    "id": "cat-dairy-eggs",
    "name": "Dairy, Eggs & Chilled",
    "description": "Organic milk, farmhouse cheeses, free-range eggs and yogurts",
    "imageUrl": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80",
    "iconName": "Egg",
    "subcategories": [
      {
        "id": "cat-dairy-milk",
        "name": "Fresh Milk, Plant Milks & Cream"
      },
      {
        "id": "cat-dairy-butter",
        "name": "Farmhouse Butter & Spreads"
      },
      {
        "id": "cat-dairy-eggs",
        "name": "Free-Range & Organic Eggs"
      },
      {
        "id": "cat-dairy-cheese",
        "name": "Cheddar, Continental & Artisan Cheese"
      },
      {
        "id": "cat-dairy-yogurt",
        "name": "Greek, Live Culture & Natural Yogurt"
      }
    ]
  },
  {
    "id": "cat-meat-fish",
    "name": "Meat, Seafood & Plant-Based",
    "description": "Grass-fed beef, organic poultry, sustainable fish and vegetarian alternatives",
    "imageUrl": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80",
    "iconName": "Beef",
    "subcategories": [
      {
        "id": "cat-meat-poultry",
        "name": "Free-Range Chicken & Turkey"
      },
      {
        "id": "cat-meat-beef-pork",
        "name": "British Grass-Fed Beef & Pork"
      },
      {
        "id": "cat-meat-fish",
        "name": "Fresh Salmon, White Fish & Prawns"
      },
      {
        "id": "cat-meat-plant",
        "name": "Tofu, Tempeh & Plant-Based Burgers"
      },
      {
        "id": "cat-meat-charcuterie",
        "name": "Prosciutto, Salami & Cooked Hams"
      }
    ]
  },
  {
    "id": "cat-ready-meals",
    "name": "Prepared Meals & Pizza",
    "description": "Woodfired pizzas, fresh pasta, handmade soups and evening dishes",
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80",
    "iconName": "Pizza",
    "subcategories": [
      {
        "id": "cat-ready-pizza",
        "name": "Fresh Stonebaked Pizzas"
      },
      {
        "id": "cat-ready-pasta",
        "name": "Fresh Filled Pasta & Sauces"
      },
      {
        "id": "cat-ready-curry",
        "name": "Indian, Thai & Asian Ready Meals"
      },
      {
        "id": "cat-ready-pies",
        "name": "Traditional Hand-Crimped Pies"
      },
      {
        "id": "cat-ready-soups",
        "name": "Fresh Chilled Soups & Dips"
      }
    ]
  },
  {
    "id": "cat-drinks",
    "name": "Drinks & Beverages",
    "description": "Cold-pressed juices, sodas, kombucha, artisan coffee & English teas",
    "imageUrl": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80",
    "iconName": "Coffee",
    "subcategories": [
      {
        "id": "cat-drinks-cold-juice",
        "name": "Cold-Pressed Juices & Smoothies"
      },
      {
        "id": "cat-drinks-sodas",
        "name": "Craft Sparkling Sodas & Tonics"
      },
      {
        "id": "cat-drinks-kombucha",
        "name": "Raw Fermented Kombucha & Kefir"
      },
      {
        "id": "cat-drinks-water",
        "name": "Spring Waters & Sparkling Waters"
      },
      {
        "id": "cat-drinks-coffee-tea",
        "name": "Specialty Coffee Beans & Loose Leaf Tea"
      }
    ]
  },
  {
    "id": "cat-snacks-confectionery",
    "name": "Snacks, Crisps & Sweet Treats",
    "description": "Handcooked crisps, single-origin chocolate, roasted nuts and biscuits",
    "imageUrl": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80",
    "iconName": "Cookie",
    "subcategories": [
      {
        "id": "cat-snacks-crisps",
        "name": "Handcooked Crisps & Popcorn"
      },
      {
        "id": "cat-snacks-chocolate",
        "name": "Artisan Dark & Milk Chocolate"
      },
      {
        "id": "cat-snacks-nuts",
        "name": "Roasted Almonds, Cashews & Dried Fruit"
      },
      {
        "id": "cat-snacks-biscuits",
        "name": "Shortbread, Oatcakes & Sweet Biscuits"
      },
      {
        "id": "cat-snacks-sweets",
        "name": "Gourmet Gummies & Confectionery"
      }
    ]
  },
  {
    "id": "cat-beer-wine-spirits",
    "name": "Beer, Wine & Fine Spirits",
    "description": "Natural wines, craft IPAs, English sparkling and botanical spirits (18+)",
    "imageUrl": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80",
    "iconName": "Wine",
    "subcategories": [
      {
        "id": "cat-alcohol-wine-red",
        "name": "Natural & Organic Red Wine"
      },
      {
        "id": "cat-alcohol-wine-white",
        "name": "Crisp White & Rosé Wine"
      },
      {
        "id": "cat-alcohol-sparkling",
        "name": "English Sparkling & Champagne"
      },
      {
        "id": "cat-alcohol-craft-beer",
        "name": "Craft IPAs, Pale Ales & Stouts"
      },
      {
        "id": "cat-alcohol-spirits",
        "name": "Artisan Gin, Whisky, Rum & Aperitifs"
      }
    ]
  },
  {
    "id": "cat-pantry-essentials",
    "name": "Pantry, Oils & Condiments",
    "description": "Extra virgin olive oil, aged balsamic, pasta, organic grains and seasonings",
    "imageUrl": "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80",
    "iconName": "Soup",
    "subcategories": [
      {
        "id": "cat-pantry-oils",
        "name": "Extra Virgin Olive Oil & Vinegars"
      },
      {
        "id": "cat-pantry-grains",
        "name": "Bronze-Die Dried Pasta, Rice & Grains"
      },
      {
        "id": "cat-pantry-sauces",
        "name": "Passata, Pestos & Chutneys"
      },
      {
        "id": "cat-pantry-spices",
        "name": "Sea Salts, Peppers & Organic Spices"
      },
      {
        "id": "cat-pantry-canned",
        "name": "Organic Pulses, Beans & Tomatoes"
      }
    ]
  },
  {
    "id": "cat-health-household",
    "name": "Pharmacy, Wellness & Home",
    "description": "Over-the-counter pain relief, cold care, eco cleaning & toiletries",
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "iconName": "HeartPulse",
    "subcategories": [
      {
        "id": "cat-health-pain-relief",
        "name": "Pain Relief & Paracetamol (Medicine limit 2)"
      },
      {
        "id": "cat-health-cold-flu",
        "name": "Cold & Flu, Throat Lozenges"
      },
      {
        "id": "cat-health-first-aid",
        "name": "First Aid, Bandages & Antiseptics"
      },
      {
        "id": "cat-home-cleaning",
        "name": "Eco Dish Soap & Multi-Surface Sprays"
      },
      {
        "id": "cat-home-paper",
        "name": "Bamboo Kitchen Roll & Toilet Tissue"
      }
    ]
  }
];

export const MARKET_LANE_ROOT_PRODUCTS: RootCatalogProduct[] = [
  {
    "id": "prod-plu-banana-loose",
    "plu": "PLU-BANANA-LOOSE",
    "gtin": [
      "5051234001011"
    ],
    "name": "Fairtrade Organic Bananas (Bunch of 5)",
    "description": "Sustainably sourced, sweet and creamy organic bananas from certified Fairtrade cooperatives in Colombia.",
    "brand": "Market Lane Organics",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-tropical"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.35,
    "displayLabels": [
      "Organic",
      "Fairtrade"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC",
      "VEGAN"
    ],
    "allergens": [],
    "supplementalInfo": {
      "origin": "Colombia",
      "netQuantity": "5 pack",
      "storageInstructions": "Store in a cool dry place, do not refrigerate"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-strawberry-400g",
    "plu": "PLU-STRAWBERRY-400G",
    "gtin": [
      "5051234001028"
    ],
    "name": "Essex Farm Fresh Strawberries 400g",
    "description": "Sweet, handpicked local strawberries grown in soil sheltered under glass in Tiptree, Essex.",
    "brand": "Tiptree Local Growers",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-berries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.95,
    "displayLabels": [
      "Local Heritage",
      "Save 50p"
    ],
    "productTags": [
      "FRESH",
      "SPECIAL_OFFER"
    ],
    "allergens": [],
    "supplementalInfo": {
      "origin": "United Kingdom (Essex)",
      "netQuantity": "400g",
      "storageInstructions": "Keep refrigerated"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-blueberry-200g",
    "plu": "PLU-BLUEBERRY-200G",
    "gtin": [
      "5051234001035"
    ],
    "name": "Plump Organic Blueberries 200g",
    "description": "Sweet and bursting with natural juices, picked at peak ripeness.",
    "brand": "Market Lane Organics",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-berries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.5,
    "displayLabels": [
      "Organic",
      "High Antioxidant"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-raspberry-150g",
    "plu": "PLU-RASPBERRY-150G",
    "gtin": [
      "5051234001042"
    ],
    "name": "Fresh English Raspberries 150g",
    "description": "Delicate, intensely aromatic raspberries grown in Kent and delivered daily.",
    "brand": "Hugh Lowe Farms",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-berries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1577069808021-512c4b8b6932?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1577069808021-512c4b8b6932?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.8,
    "displayLabels": [
      "British Grown"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-apples-cox-6pk",
    "plu": "PLU-APPLES-COX-6PK",
    "gtin": [
      "5051234001059"
    ],
    "name": "British Cox Orange Pippin Apples 6 Pack",
    "description": "Aromatic, crisp British eating apples with the classic balance of honeyed sweetness and tartness.",
    "brand": "Heritage Orchard",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-citrus"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.3,
    "displayLabels": [
      "British Classic"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-avocado-ripe-2pk",
    "plu": "PLU-AVOCADO-RIPE-2PK",
    "gtin": [
      "5051234001066"
    ],
    "name": "Hass Ready to Eat Avocados 2 Pack",
    "description": "Rich, buttery Hass avocados, conditioned to perfect ripeness ready for slicing or guacamole.",
    "brand": "Market Lane Select",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-tropical"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.95,
    "displayLabels": [
      "Perfect Ripeness"
    ],
    "productTags": [
      "FRESH",
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-lemons-unwaxed-4pk",
    "plu": "PLU-LEMONS-UNWAXED-4PK",
    "gtin": [
      "5051234001073"
    ],
    "name": "Organic Unwaxed Amalfi Lemons 4 Pack",
    "description": "Aromatic unwaxed lemons, ideal for zesting into dressings, baking, or gin & tonics.",
    "brand": "Market Lane Organics",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-citrus"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.1,
    "displayLabels": [
      "Unwaxed Zest"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-tomatoes-vine-400g",
    "plu": "PLU-TOMATOES-VINE-400G",
    "gtin": [
      "5051234001080"
    ],
    "name": "Sweet Piccolo Cherry Tomatoes on the Vine 350g",
    "description": "Intensely sweet cherry vine tomatoes sun-ripened on the Isle of Wight.",
    "brand": "Isle of Wight Tomatoes",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.65,
    "displayLabels": [
      "Award Winning"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-cucumber-organic",
    "plu": "PLU-CUCUMBER-ORGANIC",
    "gtin": [
      "5051234001097"
    ],
    "name": "Organic British Whole Cucumber",
    "description": "Fresh, hydrating organic whole cucumber grown in Lea Valley glasshouses.",
    "brand": "Market Lane Organics",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 0.95,
    "displayLabels": [
      "Crisp & Cool"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-spinach-baby-200g",
    "plu": "PLU-SPINACH-BABY-200G",
    "gtin": [
      "5051234001103"
    ],
    "name": "Washed Baby Spinach Leaves 200g",
    "description": "Triple-washed tender young baby spinach leaves, ready to eat raw or quickly wilt.",
    "brand": "Market Lane Greens",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.5,
    "displayLabels": [
      "Tender Leaves"
    ],
    "productTags": [
      "FRESH",
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-salad-wild-rocket-100g",
    "plu": "PLU-SALAD-WILD-ROCKET-100G",
    "gtin": [
      "5051234001110"
    ],
    "name": "Peppery Wild Rocket Leaves 100g",
    "description": "Spicy, peppery wild rocket leaves. Washed and ready to toss with Parmesan and balsamic.",
    "brand": "Market Lane Greens",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.25,
    "displayLabels": [
      "Peppery"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-potato-baby-new-750g",
    "plu": "PLU-POTATO-BABY-NEW-750G",
    "gtin": [
      "5051234001127"
    ],
    "name": "Jersey Royal New Potatoes 750g",
    "description": "Earthy, waxy genuine Jersey Royal potatoes grown on coastal island cotils.",
    "brand": "Jersey Fresh",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-roots"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.2,
    "displayLabels": [
      "Protected Origin"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-carrots-heritage-bunch",
    "plu": "PLU-CARROTS-HERITAGE-BUNCH",
    "gtin": [
      "5051234001134"
    ],
    "name": "Heritage Rainbow Bunched Carrots 500g",
    "description": "Purple, yellow and orange heritage carrots with tops on, perfect for roasting.",
    "brand": "Market Lane Organics",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-roots"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.85,
    "displayLabels": [
      "Rainbow Hues"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-coriander-living-pot",
    "plu": "PLU-CORIANDER-LIVING-POT",
    "gtin": [
      "5051234001141"
    ],
    "name": "Living Fresh Coriander Pot",
    "description": "Fresh living coriander plant in pot for windowsill picking.",
    "brand": "Market Lane Herbs",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-herbs"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.4,
    "displayLabels": [
      "Living Herb"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-basil-living-pot",
    "plu": "PLU-BASIL-LIVING-POT",
    "gtin": [
      "5051234001158"
    ],
    "name": "Living Sweet Genovese Basil Pot",
    "description": "Fragrant broad-leaf Italian basil, essential for pizza, pasta and tomato salads.",
    "brand": "Market Lane Herbs",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-herbs"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.4,
    "displayLabels": [
      "Living Herb"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-garlic-isle-of-wight",
    "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
    "gtin": [
      "5051234001165"
    ],
    "name": "Isle of Wight Purple Garlic Bulbs 2 Pack",
    "description": "Plump purple-streaked British garlic bulbs with deep, aromatic pungent flavour.",
    "brand": "The Garlic Farm",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-roots"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.6,
    "displayLabels": [
      "Robust Flavour"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-ginger-root-organic-200g",
    "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
    "gtin": [
      "5051234001172"
    ],
    "name": "Organic Root Ginger 200g",
    "description": "Fresh, fiery organic rhizome ginger root for stir-fries, curries and lemon ginger tea.",
    "brand": "Market Lane Organics",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-roots"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.2,
    "displayLabels": [
      "Zesty Spice"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-mushrooms-chestnut-250g",
    "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
    "gtin": [
      "5051234001189"
    ],
    "name": "British Organic Chestnut Mushrooms 250g",
    "description": "Earthy, firm brown button mushrooms grown organically in the UK.",
    "brand": "Market Lane Organics",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-roots"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.35,
    "displayLabels": [
      "Firm & Earthy"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-bell-peppers-trio",
    "plu": "PLU-BELL-PEPPERS-TRIO",
    "gtin": [
      "5051234001196"
    ],
    "name": "Sweet Traffic Light Mixed Peppers 3 Pack",
    "description": "Crisp bell peppers in red, yellow and green, rich in vitamin C.",
    "brand": "Market Lane Select",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.75,
    "displayLabels": [
      "Red, Yellow, Green"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-red-onion-net-1kg",
    "plu": "PLU-RED-ONION-NET-1KG",
    "gtin": [
      "5051234001202"
    ],
    "name": "Mild British Red Onions 1kg Net",
    "description": "Sweet, mild British red onions suitable for caramelising or raw in crisp salads.",
    "brand": "Market Lane Select",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-roots"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.15,
    "displayLabels": [
      "Pantry Staple"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-sourdough-boule-800g",
    "plu": "PLU-SOURDOUGH-BOULE-800G",
    "gtin": [
      "5051234002018"
    ],
    "name": "Wildfarmed Country Sourdough Boule 800g",
    "description": "Slow-fermented regenerative wheat sourdough with blistered mahogany crust and open chewy crumb.",
    "brand": "Wildfarmed Artisan",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sourdough"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.4,
    "displayLabels": [
      "Stonebaked Daily",
      "36hr Ferment"
    ],
    "productTags": [
      "FRESH",
      "VEGAN",
      "SPECIAL_OFFER"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "supplementalInfo": {
      "netQuantity": "800g",
      "storageInstructions": "Keep in paper bag or bread bin at room temperature"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-sourdough-seeded-800g",
    "plu": "PLU-SOURDOUGH-SEEDED-800G",
    "gtin": [
      "5051234002025"
    ],
    "name": "Seven Seed & Grain Sourdough Tin 800g",
    "description": "Packed with toasted pumpkin, sunflower, golden linseed, sesame and chia seeds.",
    "brand": "Wildfarmed Artisan",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sourdough"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.65,
    "displayLabels": [
      "High Fibre",
      "Seeded"
    ],
    "productTags": [
      "FRESH",
      "VEGAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Sesame",
      "Barley"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-croissant-all-butter-2pk",
    "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
    "gtin": [
      "5051234002032"
    ],
    "name": "Pure Butter French Croissants 2 Pack",
    "description": "Flaky 24-layer all-butter French croissants baked fresh at the start of every shift.",
    "brand": "Market Lane Bakery",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-pastries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.1,
    "displayLabels": [
      "Baked This Morning",
      "Normandy Butter"
    ],
    "productTags": [
      "FRESH",
      "VEGETARIAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Milk",
      "Eggs"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pain-au-chocolat-2pk",
    "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
    "gtin": [
      "5051234002049"
    ],
    "name": "Belgian Chocolate Pain au Chocolat 2 Pack",
    "description": "Rich laminate pastry enclosing twin batons of 54% dark Belgian chocolate.",
    "brand": "Market Lane Bakery",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-pastries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1530610476181-d83430b64dcd?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.3,
    "displayLabels": [
      "Dark Belgian Chocolate"
    ],
    "productTags": [
      "FRESH",
      "VEGETARIAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Milk",
      "Soya"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-brioche-burger-buns-4pk",
    "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
    "gtin": [
      "5051234002056"
    ],
    "name": "Glazed Brioche Burger Buns 4 Pack",
    "description": "Soft, golden glazed French brioche buns, enriched with butter and egg.",
    "brand": "St Pierre",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-buns"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.85,
    "displayLabels": [
      "Golden Glaze"
    ],
    "productTags": [
      "VEGETARIAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Eggs",
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-bagels-new-york-4pk",
    "plu": "PLU-BAGELS-NEW-YORK-4PK",
    "gtin": [
      "5051234002063"
    ],
    "name": "New York Style Plain Boiled Bagels 4 Pack",
    "description": "Traditional kettle-boiled bagels with a chewy crust and dense crumb, ideal for toasting.",
    "brand": "Market Lane Bakery",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-buns"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.7,
    "displayLabels": [
      "Boiled & Baked"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-white-farmhouse-sliced-800g",
    "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
    "gtin": [
      "5051234002070"
    ],
    "name": "Farmhouse Thick Sliced White Bread 800g",
    "description": "Soft, flour-dusted thick white loaf baked for comforting toast and hearty lunch sandwiches.",
    "brand": "Market Lane Bakery",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sliced"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.45,
    "displayLabels": [
      "Toast & Sandwich"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-brown-wholemeal-sliced-800g",
    "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
    "gtin": [
      "5051234002087"
    ],
    "name": "Stoneground 100% Wholemeal Loaf 800g",
    "description": "Wholesome stoneground wholemeal bread with a nutty flavour and high natural fibre.",
    "brand": "Market Lane Bakery",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sliced"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.55,
    "displayLabels": [
      "100% Wholemeal"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fudge-brownies-4pk",
    "plu": "PLU-FUDGE-BROWNIES-4PK",
    "gtin": [
      "5051234002094"
    ],
    "name": "Triple Chocolate Sea Salt Brownie Bites 4 Pack",
    "description": "Dense, fudgy chocolate brownies topped with Maldon sea salt flakes.",
    "brand": "Market Lane Sweet",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sweets"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.8,
    "displayLabels": [
      "Gooey Centre",
      "Maldon Salt"
    ],
    "productTags": [
      "VEGETARIAN",
      "HFSS"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Milk",
      "Eggs",
      "Soya"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-cookies-choc-chip-4pk",
    "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
    "gtin": [
      "5051234002100"
    ],
    "name": "Soft-Baked Belgian Milk Chocolate Cookies 4 Pack",
    "description": "Chewy cookies loaded with generously sized Belgian milk chocolate chips.",
    "brand": "Market Lane Sweet",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sweets"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.4,
    "displayLabels": [
      "Soft Centre"
    ],
    "productTags": [
      "VEGETARIAN",
      "HFSS"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Milk",
      "Eggs",
      "Soya"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-milk-whole-4pt",
    "plu": "PLU-MILK-WHOLE-4PT",
    "gtin": [
      "5051234003015"
    ],
    "name": "Free Range Whole British Milk 4 Pints (2.27L)",
    "description": "Rich, unhomogenised British whole milk from pedigree Guernsey and Jersey cross cows grazing on lush grass pastures.",
    "brand": "Estate Dairy",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-milk"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.95,
    "price": 1.95,
    "originalPrice": 2.15,
    "displayLabels": [
      "Pasture Grazed",
      "Save 20p"
    ],
    "productTags": [
      "FRESH",
      "SPECIAL_OFFER"
    ],
    "allergens": [
      "Milk"
    ],
    "nutritionalInfo": {
      "energyKcal": 68,
      "fat": 3.8,
      "saturates": 2.4,
      "carbohydrates": 4.7,
      "sugars": 4.7,
      "protein": 3.5,
      "salt": 0.1,
      "portionSize": "100ml"
    },
    "supplementalInfo": {
      "netQuantity": "2.27L",
      "origin": "United Kingdom",
      "storageInstructions": "Keep refrigerated 1-5°C"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-milk-semi-4pt",
    "plu": "PLU-MILK-SEMI-4PT",
    "gtin": [
      "5051234003022"
    ],
    "name": "Free Range Semi-Skimmed British Milk 4 Pints (2.27L)",
    "description": "Balanced 1.8% fat semi-skimmed milk, perfect for tea, coffee and cereal.",
    "brand": "Estate Dairy",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-milk"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.95,
    "displayLabels": [
      "Pasture Grazed"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-oat-milk-barista-1l",
    "plu": "PLU-OAT-MILK-BARISTA-1L",
    "gtin": [
      "5051234003039"
    ],
    "name": "Oatly Barista Edition Oat Drink 1L",
    "description": "Silky microfoam oat milk formulated specifically for latte art and specialty coffee.",
    "brand": "Oatly",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-milk"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.15,
    "displayLabels": [
      "Foamable",
      "Plant Milk"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [
      "Oats (Gluten Free)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-eggs-organic-6pk",
    "plu": "PLU-EGGS-ORGANIC-6PK",
    "gtin": [
      "5051234003046"
    ],
    "name": "Organic Heritage Free-Range Blue & Brown Eggs 6 Pack",
    "description": "Famous Burford Brown and Cotswold Legbar eggs with rich, deep golden yolks.",
    "brand": "Clarence Court",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-eggs"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.1,
    "displayLabels": [
      "Rich Golden Yolk",
      "Organic Pasture"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC"
    ],
    "allergens": [
      "Eggs"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-butter-salty-250g",
    "plu": "PLU-BUTTER-SALTY-250G",
    "gtin": [
      "5051234003053"
    ],
    "name": "Farmhouse Cultured Salted Butter 250g",
    "description": "Slowly cultured cream churned in small batches with flakes of sea salt crystals.",
    "brand": "Estate Dairy",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-butter"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.85,
    "displayLabels": [
      "Crunchy Sea Salt",
      "Cultured Cream"
    ],
    "productTags": [
      "FRESH",
      "VEGETARIAN"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-cheddar-aged-vintage-250g",
    "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
    "gtin": [
      "5051234003060"
    ],
    "name": "Montgomery’s Clothbound Vintage Cheddar 250g",
    "description": "Somerset unpasteurised clothbound cheddar aged for 18 months, nutty with tyrosine crunch.",
    "brand": "Montgomery’s Cheddar",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-cheese"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.5,
    "displayLabels": [
      "Aged 18 Months",
      "Clothbound PDO"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-mozzarella-di-bufala-125g",
    "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
    "gtin": [
      "5051234003077"
    ],
    "name": "Mozzarella di Bufala Campana DOP 125g",
    "description": "Porcelain white buffalo milk mozzarella with succulent, yielding texture and tangy sweetness.",
    "brand": "Campania D.O.P.",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-cheese"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1592417817098-8f3d69102a47?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1592417817098-8f3d69102a47?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.45,
    "displayLabels": [
      "Authentic Buffalo DOP"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk (Buffalo)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-parmigiano-reggiano-200g",
    "plu": "PLU-PARMIGIANO-REGGIANO-200G",
    "gtin": [
      "5051234003084"
    ],
    "name": "Parmigiano Reggiano DOP 24-Month Aged 200g",
    "description": "King of cheeses from Emilia-Romagna, packed with savoury umami crystals.",
    "brand": "Zanetti Artisan",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-cheese"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.8,
    "displayLabels": [
      "24 Months Aged",
      "DOP Certified"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-greek-yogurt-auth-500g",
    "plu": "PLU-GREEK-YOGURT-AUTH-500G",
    "gtin": [
      "5051234003091"
    ],
    "name": "Total Authentic Strained Greek Yogurt 5% 500g",
    "description": "Thick, creamy strained Greek yogurt made purely with milk and live active cultures.",
    "brand": "FAGE Total",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-yogurt"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.65,
    "displayLabels": [
      "100% Natural",
      "High Protein"
    ],
    "productTags": [
      "FRESH",
      "VEGETARIAN"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-oat-yogurt-berry-350g",
    "plu": "PLU-OAT-YOGURT-BERRY-350G",
    "gtin": [
      "5051234003107"
    ],
    "name": "Oatly Blueberry Greek-Style Oatgurt 350g",
    "description": "Plant-based creamy cultured oat dessert with real wild blueberries.",
    "brand": "Oatly",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-yogurt"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584365685547-9a5fb6f3a70c?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584365685547-9a5fb6f3a70c?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.35,
    "displayLabels": [
      "Dairy-Free",
      "Live Cultures"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [
      "Oats (Gluten Free)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-chicken-breasts-organic-500g",
    "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
    "gtin": [
      "5051234004012"
    ],
    "name": "Organic Free-Range British Chicken Breasts 500g",
    "description": "Plump organic chicken breast fillets from slow-grown heritage birds roaming free pastures.",
    "brand": "Rhug Estate Organics",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-poultry"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.95,
    "displayLabels": [
      "Organic Pasture",
      "Save 65p"
    ],
    "productTags": [
      "FRESH",
      "ORGANIC",
      "SPECIAL_OFFER"
    ],
    "allergens": [],
    "supplementalInfo": {
      "origin": "United Kingdom (Wales)",
      "netQuantity": "500g",
      "storageInstructions": "Keep refrigerated 0-4°C"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-ribeye-steak-dry-aged-250g",
    "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
    "gtin": [
      "5051234004029"
    ],
    "name": "32-Day Dry Aged British Grass-Fed Ribeye 250g",
    "description": "Exquisitely marbled British beef ribeye steak, aged on Himalayan salt blocks.",
    "brand": "Market Lane Butchery",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-beef-pork"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 8.5,
    "displayLabels": [
      "Dry Aged 32 Days",
      "Heritage Breed"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-sausages-cumberland-6pk",
    "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
    "gtin": [
      "5051234004036"
    ],
    "name": "Traditional British Cumberland Pork Sausages 400g (6pk)",
    "description": "Coarse-cut British outdoor-bred pork seasoned with black pepper, sage and mace in natural skins.",
    "brand": "Market Lane Butchery",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-beef-pork"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1585325701165-351af916e581?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1585325701165-351af916e581?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.8,
    "displayLabels": [
      "85% Outdoor Pork",
      "Cracked Pepper"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Sulphites"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-salmon-loch-duart-240g",
    "plu": "PLU-SALMON-LOCH-DUART-240G",
    "gtin": [
      "5051234004043"
    ],
    "name": "Scottish Loch Duart Salmon Fillets 240g (2pk)",
    "description": "Sustainably farmed Scottish salmon fillets with firm flesh and clean, natural omega-3 richness.",
    "brand": "Loch Duart Sustainable",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-fish"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.25,
    "displayLabels": [
      "RSPCA Assured",
      "Scottish Waters"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Fish (Salmon)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-prawns-king-cooked-180g",
    "plu": "PLU-PRAWNS-KING-COOKED-180G",
    "gtin": [
      "5051234004050"
    ],
    "name": "Cooked & Peeled King Prawns 180g",
    "description": "Juicy, plump cooked king prawns ready for tossing into pastas, salads or dipping sauces.",
    "brand": "Market Lane Seafood",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-fish"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.2,
    "displayLabels": [
      "Ready to Eat"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Crustaceans (Prawns)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-tofu-extra-firm-organic-280g",
    "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
    "gtin": [
      "5051234004067"
    ],
    "name": "The Tofoo Co. Naked Organic Extra Firm Tofu 280g",
    "description": "Handmade organic tofu made with nigari, pre-pressed and ready to dice and fry crisp.",
    "brand": "The Tofoo Co.",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-plant"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.4,
    "displayLabels": [
      "High Protein",
      "No Pressing Needed"
    ],
    "productTags": [
      "ORGANIC",
      "VEGAN"
    ],
    "allergens": [
      "Soya"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-plant-burger-beyond-2pk",
    "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
    "gtin": [
      "5051234004074"
    ],
    "name": "Beyond Burger Plant-Based Patties 226g (2pk)",
    "description": "Juicy, meaty plant-based patties made with pea protein that grill and sizzle like beef.",
    "brand": "Beyond Meat",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-plant"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.5,
    "displayLabels": [
      "Plant-Based",
      "20g Protein"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-prosciutto-di-parma-80g",
    "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
    "gtin": [
      "5051234004081"
    ],
    "name": "Prosciutto di Parma DOP 20-Month Aged 80g",
    "description": "Silky, sweet air-cured Italian ham cured only with sea salt in the hills of Langhirano.",
    "brand": "Tanara Giancarlo",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-charcuterie"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.6,
    "displayLabels": [
      "20 Months Aged",
      "DOP Parma"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pizza-margherita-woodfired",
    "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
    "gtin": [
      "5051234005019"
    ],
    "name": "Woodfired Sourdough Margherita Pizza 450g",
    "description": "Slow-proved 48-hour sourdough base topped with San Marzano tomato sauce, fior di latte mozzarella and fresh basil.",
    "brand": "Pizza Pilgrims Daily",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pizza"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.95,
    "displayLabels": [
      "Stonebaked",
      "Save 55p"
    ],
    "productTags": [
      "FRESH",
      "VEGETARIAN",
      "SPECIAL_OFFER"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Milk"
    ],
    "supplementalInfo": {
      "netQuantity": "450g",
      "storageInstructions": "Keep refrigerated. Cook in oven 220°C for 7 mins"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pizza-spicy-nduja-woodfired",
    "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
    "gtin": [
      "5051234005026"
    ],
    "name": "Woodfired Spicy Calabrian ’Nduja & Hot Honey Pizza 480g",
    "description": "Spicy Calabrian sausage spread, pickled hot chilies, smoked provola and a drizzle of wildflower hot honey.",
    "brand": "Pizza Pilgrims Daily",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pizza"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.75,
    "displayLabels": [
      "Calabrian ’Nduja",
      "Hot Honey"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pasta-tortelloni-truffle-250g",
    "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
    "gtin": [
      "5051234005033"
    ],
    "name": "Fresh Black Truffle & Ricotta Tortelloni 250g",
    "description": "Silky fresh egg pasta filled with creamy sheep’s milk ricotta and fragrant black winter truffles.",
    "brand": "Pasta Evangelists",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pasta"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.8,
    "displayLabels": [
      "Fresh Egg Pasta",
      "Umbrian Truffle"
    ],
    "productTags": [
      "FRESH",
      "VEGETARIAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Eggs",
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pasta-sauce-slow-beef-350g",
    "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
    "gtin": [
      "5051234005040"
    ],
    "name": "Slow-Cooked Beef Shin Ragu Sauce 350g",
    "description": "British beef shin braised with Chianti wine, rosemary and San Marzano tomatoes for 8 hours.",
    "brand": "Pasta Evangelists",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pasta"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.5,
    "displayLabels": [
      "Simmered 8 Hours"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Celery",
      "Sulphites"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-curry-butter-chicken-400g",
    "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
    "gtin": [
      "5051234005057"
    ],
    "name": "Delhi Style Butter Chicken & Basmati Rice 450g",
    "description": "Tandoori-charred chicken thigh pieces in a rich, velvety tomato and fenugreek butter gravy with cumin rice.",
    "brand": "Gymkhana Kitchen",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-curry"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.95,
    "displayLabels": [
      "Authentic Recipe",
      "Ready in 4m"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk",
      "Cashews (Nuts)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pie-steak-ale-270g",
    "plu": "PLU-PIE-STEAK-ALE-270G",
    "gtin": [
      "5051234005064"
    ],
    "name": "Hand-Crimped British Steak & Craft Ale Pie 270g",
    "description": "Tender British chuck steak slow-simmered in rich craft stout inside crisp golden shortcrust.",
    "brand": "Pieminister",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pies"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.25,
    "displayLabels": [
      "All-Butter Pastry"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Barley",
      "Milk",
      "Eggs"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-juice-oj-fresh-1l",
    "plu": "PLU-JUICE-OJ-FRESH-1L",
    "gtin": [
      "5051234006016"
    ],
    "name": "Freshly Squeezed 100% Valencia Orange Juice 1L",
    "description": "Pure cold-pressed sunshine in a bottle, squeezed from Spanish Valencia oranges with natural juicy bits.",
    "brand": "Market Lane Press",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-cold-juice"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.2,
    "displayLabels": [
      "Never from Concentrate",
      "With Juicy Bits"
    ],
    "productTags": [
      "FRESH",
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-juice-green-cleanse-330ml",
    "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
    "gtin": [
      "5051234006023"
    ],
    "name": "Organic Super Green Cold-Pressed Juice 330ml",
    "description": "Crisp green cold-pressed blend of cucumber, spinach, kale, ginger and Sicilian lime.",
    "brand": "Plenish Cleanse",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-cold-juice"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.85,
    "displayLabels": [
      "Cold-Pressed",
      "Kale, Apple, Lime"
    ],
    "productTags": [
      "ORGANIC",
      "VEGAN"
    ],
    "allergens": [
      "Celery"
    ],
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-kombucha-ginger-lemon-330ml",
    "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
    "gtin": [
      "5051234006030"
    ],
    "name": "Organic Fiery Ginger & Turmeric Kombucha 330ml Can",
    "description": "Raw live sparkling fermented tea cold-infused with organic crushed ginger root and golden turmeric.",
    "brand": "Equinox Kombucha",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-kombucha"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.25,
    "displayLabels": [
      "Raw Live Cultures",
      "Low Sugar"
    ],
    "productTags": [
      "ORGANIC",
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-soda-rhubarb-cardamom-275ml",
    "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
    "gtin": [
      "5051234006047"
    ],
    "name": "British Sparkling Wild Rhubarb & Cardamom Soda 275ml",
    "description": "Lightly sparkling soda crafted with Yorkshire rhubarb juice and a hint of crushed green cardamom pods.",
    "brand": "Something & Nothing",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-sodas"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.85,
    "displayLabels": [
      "All Natural",
      "Low Calorie"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0.15,
    "active": true
  },
  {
    "id": "prod-plu-coffee-beans-guatemala-250g",
    "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
    "gtin": [
      "5051234006054"
    ],
    "name": "Guatemala Huehuetenango Single Origin Coffee Beans 250g",
    "description": "Washed single-origin specialty coffee beans featuring tasting notes of red apple, dark cocoa and caramel.",
    "brand": "Origin Coffee Roasters",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-coffee-tea"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 8.5,
    "displayLabels": [
      "Specialty Grade",
      "Omni Roast"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [],
    "beverageInfo": {
      "caffeineContent": "High (Natural)"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-tea-english-breakfast-50bags",
    "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
    "gtin": [
      "5051234006061"
    ],
    "name": "Proper English Breakfast Tea 50 Biodegradable Bags",
    "description": "Brisk, full-bodied black tea blend crafted to take milk perfectly in the morning.",
    "brand": "Good & Proper Tea",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-coffee-tea"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.2,
    "displayLabels": [
      "Plastic-Free Bags",
      "Assam & Ceylon"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-crisps-sea-salt-cider-150g",
    "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
    "gtin": [
      "5051234007013"
    ],
    "name": "Dorset Sea Salt & Somerset Cider Vinegar Crisps 150g",
    "description": "Thick-cut hand-cooked potato crisps with sharp tangy cider vinegar and Dorset sea salt.",
    "brand": "Savoursmiths",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-crisps"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.35,
    "displayLabels": [
      "Hand Cooked",
      "British Potatoes"
    ],
    "productTags": [
      "VEGAN",
      "GLUTEN_FREE"
    ],
    "allergens": [],
    "supplementalInfo": {
      "netQuantity": "150g"
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-crisps-truffle-rosemary-150g",
    "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
    "gtin": [
      "5051234007020"
    ],
    "name": "Somerset Black Truffle & Rosemary Crisps 150g",
    "description": "Luxurious crisps infused with real black truffle shavings and crushed garden rosemary.",
    "brand": "Savoursmiths",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-crisps"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1527842891421-42eec6e703ea?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.65,
    "displayLabels": [
      "Gourmet Truffle"
    ],
    "productTags": [
      "VEGETARIAN",
      "GLUTEN_FREE"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-choc-dark-sea-salt-70g",
    "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
    "gtin": [
      "5051234007037"
    ],
    "name": "70% Madagascar Dark Chocolate with Sea Salt 70g",
    "description": "Craft bean-to-bar single-origin chocolate from Orford, Suffolk with bright red berry acidity and sea salt.",
    "brand": "Pump Street Chocolate",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-chocolate"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1548907040-4baa42d10919?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1548907040-4baa42d10919?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.25,
    "displayLabels": [
      "Single Origin",
      "Bean to Bar"
    ],
    "productTags": [
      "VEGAN",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-nuts-smoked-almonds-120g",
    "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
    "gtin": [
      "5051234007044"
    ],
    "name": "Hickory Smoked & Roasted Valencia Almonds 120g",
    "description": "Spanish Valencia almonds roasted slowly over hickory wood chips with coarse sea salt.",
    "brand": "Market Lane Pantry",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-nuts"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.1,
    "displayLabels": [
      "Slow Roasted"
    ],
    "productTags": [
      "VEGAN",
      "GLUTEN_FREE"
    ],
    "allergens": [
      "Almonds (Nuts)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-biscuits-all-butter-shortbread-160g",
    "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
    "gtin": [
      "5051234007051"
    ],
    "name": "Isle of Mull All-Butter Traditional Shortbread 160g",
    "description": "Melt-in-the-mouth organic shortbread baked in wood-fired ovens on the Isle of Mull.",
    "brand": "Island Bakery Organics",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-biscuits"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.2,
    "displayLabels": [
      "Baked with Wood Power",
      "Organic"
    ],
    "productTags": [
      "ORGANIC",
      "VEGETARIAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-gin-cotswolds-70cl",
    "plu": "PLU-GIN-COTSWOLDS-70CL",
    "gtin": [
      "5051234008010"
    ],
    "name": "Cotswolds Artisan Botanical Dry Gin 70cl",
    "description": "Distilled with locally grown Cotswolds lavender, freshly peeled pink grapefruit and lime zest in copper pot stills.",
    "brand": "Cotswolds Distillery",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-spirits"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 36.5,
    "displayLabels": [
      "18+ Challenge 25",
      "Save £3.50",
      "Artisan Spirit"
    ],
    "productTags": [
      "AGE_RESTRICTED_18",
      "SPECIAL_OFFER"
    ],
    "allergens": [],
    "supplementalInfo": {
      "netQuantity": "70cl",
      "origin": "United Kingdom"
    },
    "beverageInfo": {
      "alcoholByVolume": 46,
      "isAlcoholic": true
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-wine-chablis-organic-75cl",
    "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
    "gtin": [
      "5051234008027"
    ],
    "name": "Domaine Charly Nicolle Chablis Ancestrum 75cl",
    "description": "Vibrant, flinty dry white Burgundy boasting oyster-shell minerality and lemon blossom freshness.",
    "brand": "Domaine Charly Nicolle",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-wine-white"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 22,
    "displayLabels": [
      "18+ ID Required",
      "Kimmeridgian Mineral"
    ],
    "productTags": [
      "AGE_RESTRICTED_18"
    ],
    "allergens": [
      "Sulphites"
    ],
    "beverageInfo": {
      "alcoholByVolume": 12.5,
      "isAlcoholic": true
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-wine-rioja-reserva-75cl",
    "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
    "gtin": [
      "5051234008034"
    ],
    "name": "Viña Ardanza Rioja Reserva 2017 75cl",
    "description": "Iconic Spanish Tempranillo and Garnacha blend aged in American oak with sweet spice, leather and wild strawberry notes.",
    "brand": "La Rioja Alta S.A.",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-wine-red"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 32.5,
    "displayLabels": [
      "18+ ID Required",
      "Oak Aged 36M"
    ],
    "productTags": [
      "AGE_RESTRICTED_18"
    ],
    "allergens": [
      "Sulphites"
    ],
    "beverageInfo": {
      "alcoholByVolume": 14.5,
      "isAlcoholic": true
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-sparkling-nyetimber-classic-75cl",
    "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
    "gtin": [
      "5051234008041"
    ],
    "name": "Nyetimber Classic Cuvée English Sparkling Wine 75cl",
    "description": "World-renowned Sussex sparkling wine, toasted brioche complexity with crystalline green apple elegance.",
    "brand": "Nyetimber Estate",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-sparkling"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 38,
    "displayLabels": [
      "18+ ID Required",
      "Sussex Chalk Terroir"
    ],
    "productTags": [
      "AGE_RESTRICTED_18"
    ],
    "allergens": [
      "Sulphites"
    ],
    "beverageInfo": {
      "alcoholByVolume": 12,
      "isAlcoholic": true
    },
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-beer-verdant-lightbulb-440ml",
    "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
    "gtin": [
      "5051234008058"
    ],
    "name": "Verdant Brewing Lightbulb Extra Pale Ale 440ml Can",
    "description": "Cornish hazy extra pale ale dry-hopped generously with juicy Motueka and Centennial hops.",
    "brand": "Verdant Brewing Co.",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-craft-beer"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1608270546103-9733a89e3882?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1608270546103-9733a89e3882?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.6,
    "displayLabels": [
      "18+ ID Required",
      "Hazy Pale 4.5%"
    ],
    "productTags": [
      "AGE_RESTRICTED_18",
      "VEGAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Barley",
      "Oats"
    ],
    "beverageInfo": {
      "alcoholByVolume": 4.5,
      "isAlcoholic": true
    },
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-beer-deya-steady-rolling-500ml",
    "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
    "gtin": [
      "5051234008065"
    ],
    "name": "DEYA Steady Rolling Man New England Pale Ale 500ml Can",
    "description": "The definitive British hazy pale ale with tropical mango, passionfruit aromas and a velvety mouthfeel.",
    "brand": "DEYA Brewing Company",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-craft-beer"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.4,
    "displayLabels": [
      "18+ ID Required",
      "Cheltenham Craft"
    ],
    "productTags": [
      "AGE_RESTRICTED_18",
      "VEGAN"
    ],
    "allergens": [
      "Wheat (Gluten)",
      "Barley",
      "Oats"
    ],
    "beverageInfo": {
      "alcoholByVolume": 5.2,
      "isAlcoholic": true
    },
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-oil-evoo-frantoio-500ml",
    "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
    "gtin": [
      "5051234009017"
    ],
    "name": "Frantoio Muraglia Cold-Extracted Extra Virgin Olive Oil 500ml",
    "description": "Monovarietal Coratina olive oil pressed within 24 hours in Puglia, grassy with a peppery finish.",
    "brand": "Frantoio Muraglia",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-oils"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 16.5,
    "displayLabels": [
      "Cold Extracted",
      "Puglia Single Estate"
    ],
    "productTags": [
      "ORGANIC",
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pasta-bronze-rigatoni-500g",
    "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
    "gtin": [
      "5051234009024"
    ],
    "name": "Gentile Gragnano IGP Bronze-Die Rigatoni 500g",
    "description": "Authentic 100% Italian durum wheat semolina extruded through bronze dies and dried slowly at low temperatures.",
    "brand": "Pastificio Gentile",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-grains"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.4,
    "displayLabels": [
      "IGP Gragnano",
      "Slow Dried"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-tomatoes-san-marzano-dop-400g",
    "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
    "gtin": [
      "5051234009031"
    ],
    "name": "San Marzano dell’Agro Sarnese-Nocerino DOP Peeled Tomatoes 400g",
    "description": "Elongated Italian plum tomatoes grown in the volcanic soils around Mount Vesuvius.",
    "brand": "Strianese Artisan",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-canned"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.1,
    "displayLabels": [
      "DOP Certified",
      "Volcanic Soil"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-salt-maldon-sea-salt-250g",
    "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
    "gtin": [
      "5051234009048"
    ],
    "name": "Maldon Original Sea Salt Flakes 250g Box",
    "description": "Pyramid salt crystals harvested by hand in Maldon, Essex since 1882.",
    "brand": "Maldon Salt Co.",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-spices"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.95,
    "displayLabels": [
      "Essex Heritage",
      "Royal Warrant"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pesto-genovese-organic-190g",
    "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
    "gtin": [
      "5051234009055"
    ],
    "name": "Organic Ligurian Pesto alla Genovese DOP 190g",
    "description": "Unheated raw Ligurian basil ground with extra virgin olive oil, Parmigiano Reggiano and whole pine nuts.",
    "brand": "Seggiano Organic",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-sauces"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1594998893017-36147cbcae05?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1594998893017-36147cbcae05?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.8,
    "displayLabels": [
      "DOP Basil",
      "Raw Unheated"
    ],
    "productTags": [
      "ORGANIC",
      "VEGETARIAN"
    ],
    "allergens": [
      "Milk",
      "Pine Nuts (Tree Nuts)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-paracetamol-500mg-16pk",
    "plu": "PLU-PARACETAMOL-500MG-16PK",
    "gtin": [
      "5051234010013"
    ],
    "name": "Paracetamol Tablets 500mg (16 Pack)",
    "description": "Effective temporary relief from mild to moderate pain including headache, toothache, fever and symptoms of colds and flu.",
    "brand": "HealthGuard Pharmacy",
    "categoryIds": [
      "cat-health-household",
      "cat-health-pain-relief"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 0.65,
    "displayLabels": [
      "Max 2 per order",
      "Pain & Fever Relief"
    ],
    "productTags": [
      "MEDICINE_LIMIT"
    ],
    "allergens": [],
    "supplementalInfo": {
      "storageInstructions": "Store below 25°C in original blister pack"
    },
    "deposit": 0,
    "multiMax": 2,
    "active": true
  },
  {
    "id": "prod-plu-ibuprofen-200mg-16pk",
    "plu": "PLU-IBUPROFEN-200MG-16PK",
    "gtin": [
      "5051234010020"
    ],
    "name": "Ibuprofen Coated Tablets 200mg (16 Pack)",
    "description": "Fast-acting anti-inflammatory relief for muscular aches, dental pain, backache and period pain.",
    "brand": "HealthGuard Pharmacy",
    "categoryIds": [
      "cat-health-household",
      "cat-health-pain-relief"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 0.85,
    "displayLabels": [
      "Max 2 per order",
      "Anti-Inflammatory"
    ],
    "productTags": [
      "MEDICINE_LIMIT"
    ],
    "allergens": [],
    "deposit": 0,
    "multiMax": 2,
    "active": true
  },
  {
    "id": "prod-plu-ecover-washing-up-lime-450ml",
    "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
    "gtin": [
      "5051234010037"
    ],
    "name": "Ecover Camomile & Clementine Washing-Up Liquid 450ml",
    "description": "Plant-based cleaning formula that cuts through grease while caring for sensitive skin.",
    "brand": "Ecover",
    "categoryIds": [
      "cat-health-household",
      "cat-home-cleaning"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1585670270677-3acce8360037?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1585670270677-3acce8360037?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.85,
    "displayLabels": [
      "Biodegradable",
      "100% Recycled Bottle"
    ],
    "productTags": [
      "VEGAN"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-bamboo-kitchen-roll-2pk",
    "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
    "gtin": [
      "5051234010044"
    ],
    "name": "Cheeky Panda 100% Virgin Bamboo Kitchen Towel 2 Rolls",
    "description": "Naturally antibacterial and sustainable virgin bamboo kitchen towels, strong when wet.",
    "brand": "The Cheeky Panda",
    "categoryIds": [
      "cat-health-household",
      "cat-home-paper"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=600&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.5,
    "displayLabels": [
      "Plastic Free Packaging",
      "Ultra Absorbent"
    ],
    "productTags": [
      "VEGAN",
      "ORGANIC"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-frui-1",
    "plu": "PLU-FRES-FRUI-1",
    "gtin": [
      "50500143966"
    ],
    "name": "Heritage Berries, Small Batch (100g)",
    "description": "Premium quality heritage berries, small batch (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Berries,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-berries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.3,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-frui-2",
    "plu": "PLU-FRES-FRUI-2",
    "gtin": [
      "50500259262"
    ],
    "name": "Valley Fresh Berries, Hand Selected (200g)",
    "description": "Premium quality valley fresh berries, hand selected (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Berries,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-berries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.1,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-frui-3",
    "plu": "PLU-FRES-FRUI-3",
    "gtin": [
      "50500323799"
    ],
    "name": "Farmhouse Berries, Traditional (300g)",
    "description": "Premium quality farmhouse berries, traditional (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Berries,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-berries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.9,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-frui-4",
    "plu": "PLU-FRES-FRUI-4",
    "gtin": [
      "50500469727"
    ],
    "name": "Organic Berries, Artisan (400g)",
    "description": "Premium quality organic berries, artisan (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Berries,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-fruit-berries"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.95,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-veg--1",
    "plu": "PLU-FRES-VEG--1",
    "gtin": [
      "50503174590"
    ],
    "name": "Organic Salad, Artisan (100g)",
    "description": "Premium quality organic salad, artisan (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Salad,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 7.35,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-veg--2",
    "plu": "PLU-FRES-VEG--2",
    "gtin": [
      "50503221493"
    ],
    "name": "Heritage Salad, Small Batch (200g)",
    "description": "Premium quality heritage salad, small batch (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Salad,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.4,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-veg--3",
    "plu": "PLU-FRES-VEG--3",
    "gtin": [
      "50503377126"
    ],
    "name": "Valley Fresh Salad, Hand Selected (300g)",
    "description": "Premium quality valley fresh salad, hand selected (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Salad,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.2,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-fres-veg--4",
    "plu": "PLU-FRES-VEG--4",
    "gtin": [
      "50503410111"
    ],
    "name": "Farmhouse Salad, Traditional (400g)",
    "description": "Premium quality farmhouse salad, traditional (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Salad,",
    "categoryIds": [
      "cat-fresh-produce",
      "cat-veg-salads"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-bake-bake-1",
    "plu": "PLU-BAKE-BAKE-1",
    "gtin": [
      "50510117684"
    ],
    "name": "Valley Fresh Artisan Hand Selected (100g)",
    "description": "Premium quality valley fresh artisan hand selected (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Artisan",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sourdough"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.45,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-bake-bake-2",
    "plu": "PLU-BAKE-BAKE-2",
    "gtin": [
      "50510226923"
    ],
    "name": "Farmhouse Artisan Traditional (200g)",
    "description": "Premium quality farmhouse artisan traditional (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Artisan",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sourdough"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.5,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-bake-bake-3",
    "plu": "PLU-BAKE-BAKE-3",
    "gtin": [
      "50510389671"
    ],
    "name": "Organic Artisan Artisan (300g)",
    "description": "Premium quality organic artisan artisan (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Artisan",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sourdough"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.3,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-bake-bake-4",
    "plu": "PLU-BAKE-BAKE-4",
    "gtin": [
      "50510463800"
    ],
    "name": "Heritage Artisan Small Batch (400g)",
    "description": "Premium quality heritage artisan small batch (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Artisan",
    "categoryIds": [
      "cat-bakery",
      "cat-bakery-sourdough"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.1,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Wheat (Gluten)"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-dair-dair-1",
    "plu": "PLU-DAIR-DAIR-1",
    "gtin": [
      "50520171586"
    ],
    "name": "Farmhouse Fresh Traditional (100g)",
    "description": "Premium quality farmhouse fresh traditional (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-milk"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.85,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-dair-dair-2",
    "plu": "PLU-DAIR-DAIR-2",
    "gtin": [
      "50520233172"
    ],
    "name": "Organic Fresh Artisan (200g)",
    "description": "Premium quality organic fresh artisan (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-milk"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.65,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-dair-dair-3",
    "plu": "PLU-DAIR-DAIR-3",
    "gtin": [
      "50520310232"
    ],
    "name": "Heritage Fresh Small Batch (300g)",
    "description": "Premium quality heritage fresh small batch (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-milk"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.45,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-dair-dair-4",
    "plu": "PLU-DAIR-DAIR-4",
    "gtin": [
      "50520420731"
    ],
    "name": "Valley Fresh Fresh Hand Selected (400g)",
    "description": "Premium quality valley fresh fresh hand selected (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-dairy-eggs",
      "cat-dairy-milk"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.5,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [
      "Milk"
    ],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-meat-meat-1",
    "plu": "PLU-MEAT-MEAT-1",
    "gtin": [
      "50530125928"
    ],
    "name": "Organic Free-Range Artisan (100g)",
    "description": "Premium quality organic free-range artisan (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Free-Range",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-poultry"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-meat-meat-2",
    "plu": "PLU-MEAT-MEAT-2",
    "gtin": [
      "50530253814"
    ],
    "name": "Heritage Free-Range Small Batch (200g)",
    "description": "Premium quality heritage free-range small batch (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Free-Range",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-poultry"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 7.8,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-meat-meat-3",
    "plu": "PLU-MEAT-MEAT-3",
    "gtin": [
      "50530359895"
    ],
    "name": "Valley Fresh Free-Range Hand Selected (300g)",
    "description": "Premium quality valley fresh free-range hand selected (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Free-Range",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-poultry"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.85,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-meat-meat-4",
    "plu": "PLU-MEAT-MEAT-4",
    "gtin": [
      "50530496371"
    ],
    "name": "Farmhouse Free-Range Traditional (400g)",
    "description": "Premium quality farmhouse free-range traditional (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Free-Range",
    "categoryIds": [
      "cat-meat-fish",
      "cat-meat-poultry"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.65,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-read-read-1",
    "plu": "PLU-READ-READ-1",
    "gtin": [
      "50540148066"
    ],
    "name": "Heritage Fresh Small Batch (100g)",
    "description": "Premium quality heritage fresh small batch (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pizza"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.4,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-read-read-2",
    "plu": "PLU-READ-READ-2",
    "gtin": [
      "50540269194"
    ],
    "name": "Valley Fresh Fresh Hand Selected (200g)",
    "description": "Premium quality valley fresh fresh hand selected (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pizza"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.2,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-read-read-3",
    "plu": "PLU-READ-READ-3",
    "gtin": [
      "50540376831"
    ],
    "name": "Farmhouse Fresh Traditional (300g)",
    "description": "Premium quality farmhouse fresh traditional (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pizza"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-read-read-4",
    "plu": "PLU-READ-READ-4",
    "gtin": [
      "50540422138"
    ],
    "name": "Organic Fresh Artisan (400g)",
    "description": "Premium quality organic fresh artisan (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Fresh",
    "categoryIds": [
      "cat-ready-meals",
      "cat-ready-pizza"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 7.8,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-drin-drin-1",
    "plu": "PLU-DRIN-DRIN-1",
    "gtin": [
      "50550126219"
    ],
    "name": "Valley Fresh Cold-Pressed Hand Selected (100g)",
    "description": "Premium quality valley fresh cold-pressed hand selected (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Cold-Pressed",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-cold-juice"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.55,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-drin-drin-2",
    "plu": "PLU-DRIN-DRIN-2",
    "gtin": [
      "50550278008"
    ],
    "name": "Farmhouse Cold-Pressed Traditional (200g)",
    "description": "Premium quality farmhouse cold-pressed traditional (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Cold-Pressed",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-cold-juice"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 7.35,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-drin-drin-3",
    "plu": "PLU-DRIN-DRIN-3",
    "gtin": [
      "50550382838"
    ],
    "name": "Organic Cold-Pressed Artisan (300g)",
    "description": "Premium quality organic cold-pressed artisan (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Cold-Pressed",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-cold-juice"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 2.4,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-drin-drin-4",
    "plu": "PLU-DRIN-DRIN-4",
    "gtin": [
      "50550419059"
    ],
    "name": "Heritage Cold-Pressed Small Batch (400g)",
    "description": "Premium quality heritage cold-pressed small batch (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Cold-Pressed",
    "categoryIds": [
      "cat-drinks",
      "cat-drinks-cold-juice"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.2,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-snac-snac-1",
    "plu": "PLU-SNAC-SNAC-1",
    "gtin": [
      "50560187352"
    ],
    "name": "Farmhouse Handcooked Traditional (100g)",
    "description": "Premium quality farmhouse handcooked traditional (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Handcooked",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-crisps"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.95,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-snac-snac-2",
    "plu": "PLU-SNAC-SNAC-2",
    "gtin": [
      "50560297295"
    ],
    "name": "Organic Handcooked Artisan (200g)",
    "description": "Premium quality organic handcooked artisan (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Handcooked",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-crisps"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.75,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-snac-snac-3",
    "plu": "PLU-SNAC-SNAC-3",
    "gtin": [
      "50560352012"
    ],
    "name": "Heritage Handcooked Small Batch (300g)",
    "description": "Premium quality heritage handcooked small batch (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Handcooked",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-crisps"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.55,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-snac-snac-4",
    "plu": "PLU-SNAC-SNAC-4",
    "gtin": [
      "50560480220"
    ],
    "name": "Valley Fresh Handcooked Hand Selected (400g)",
    "description": "Premium quality valley fresh handcooked hand selected (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Handcooked",
    "categoryIds": [
      "cat-snacks-confectionery",
      "cat-snacks-crisps"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 7.35,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-beer-alco-1",
    "plu": "PLU-BEER-ALCO-1",
    "gtin": [
      "50570137779"
    ],
    "name": "Organic Natural Artisan (100g)",
    "description": "Premium quality organic natural artisan (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Natural",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-wine-red"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.1,
    "displayLabels": [
      "18+ ID Required"
    ],
    "productTags": [
      "AGE_RESTRICTED_18"
    ],
    "allergens": [],
    "beverageInfo": {
      "alcoholByVolume": 12.5,
      "isAlcoholic": true
    },
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-beer-alco-2",
    "plu": "PLU-BEER-ALCO-2",
    "gtin": [
      "50570216468"
    ],
    "name": "Heritage Natural Small Batch (200g)",
    "description": "Premium quality heritage natural small batch (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Natural",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-wine-red"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.9,
    "displayLabels": [
      "18+ ID Required"
    ],
    "productTags": [
      "AGE_RESTRICTED_18"
    ],
    "allergens": [],
    "beverageInfo": {
      "alcoholByVolume": 12.5,
      "isAlcoholic": true
    },
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-beer-alco-3",
    "plu": "PLU-BEER-ALCO-3",
    "gtin": [
      "50570383050"
    ],
    "name": "Valley Fresh Natural Hand Selected (300g)",
    "description": "Premium quality valley fresh natural hand selected (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Natural",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-wine-red"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.95,
    "displayLabels": [
      "18+ ID Required"
    ],
    "productTags": [
      "AGE_RESTRICTED_18"
    ],
    "allergens": [],
    "beverageInfo": {
      "alcoholByVolume": 12.5,
      "isAlcoholic": true
    },
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-beer-alco-4",
    "plu": "PLU-BEER-ALCO-4",
    "gtin": [
      "50570451089"
    ],
    "name": "Farmhouse Natural Traditional (400g)",
    "description": "Premium quality farmhouse natural traditional (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Natural",
    "categoryIds": [
      "cat-beer-wine-spirits",
      "cat-alcohol-wine-red"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.75,
    "displayLabels": [
      "18+ ID Required"
    ],
    "productTags": [
      "AGE_RESTRICTED_18"
    ],
    "allergens": [],
    "beverageInfo": {
      "alcoholByVolume": 12.5,
      "isAlcoholic": true
    },
    "deposit": 0.2,
    "active": true
  },
  {
    "id": "prod-plu-pant-pant-1",
    "plu": "PLU-PANT-PANT-1",
    "gtin": [
      "50580184781"
    ],
    "name": "Heritage Extra Small Batch (100g)",
    "description": "Premium quality heritage extra small batch (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Extra",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-oils"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.5,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pant-pant-2",
    "plu": "PLU-PANT-PANT-2",
    "gtin": [
      "50580299597"
    ],
    "name": "Valley Fresh Extra Hand Selected (200g)",
    "description": "Premium quality valley fresh extra hand selected (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Extra",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-oils"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.3,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pant-pant-3",
    "plu": "PLU-PANT-PANT-3",
    "gtin": [
      "50580394529"
    ],
    "name": "Farmhouse Extra Traditional (300g)",
    "description": "Premium quality farmhouse extra traditional (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Extra",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-oils"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.1,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-pant-pant-4",
    "plu": "PLU-PANT-PANT-4",
    "gtin": [
      "50580454347"
    ],
    "name": "Organic Extra Artisan (400g)",
    "description": "Premium quality organic extra artisan (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Extra",
    "categoryIds": [
      "cat-pantry-essentials",
      "cat-pantry-oils"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.9,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-heal-heal-1",
    "plu": "PLU-HEAL-HEAL-1",
    "gtin": [
      "50590136686"
    ],
    "name": "Valley Fresh Pain Hand Selected (100g)",
    "description": "Premium quality valley fresh pain hand selected (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Pain",
    "categoryIds": [
      "cat-health-household",
      "cat-health-pain-relief"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 4.65,
    "displayLabels": [
      "Max 2 per order"
    ],
    "productTags": [
      "MEDICINE_LIMIT"
    ],
    "allergens": [],
    "deposit": 0,
    "multiMax": 2,
    "active": true
  },
  {
    "id": "prod-plu-heal-heal-2",
    "plu": "PLU-HEAL-HEAL-2",
    "gtin": [
      "50590264125"
    ],
    "name": "Farmhouse Pain Traditional (200g)",
    "description": "Premium quality farmhouse pain traditional (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Pain",
    "categoryIds": [
      "cat-health-household",
      "cat-health-pain-relief"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 6.45,
    "displayLabels": [
      "Max 2 per order"
    ],
    "productTags": [
      "MEDICINE_LIMIT"
    ],
    "allergens": [],
    "deposit": 0,
    "multiMax": 2,
    "active": true
  },
  {
    "id": "prod-plu-heal-heal-3",
    "plu": "PLU-HEAL-HEAL-3",
    "gtin": [
      "50590364078"
    ],
    "name": "Organic Pain Artisan (300g)",
    "description": "Premium quality organic pain artisan (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Pain",
    "categoryIds": [
      "cat-health-household",
      "cat-health-pain-relief"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.5,
    "displayLabels": [
      "Max 2 per order"
    ],
    "productTags": [
      "MEDICINE_LIMIT"
    ],
    "allergens": [],
    "deposit": 0,
    "multiMax": 2,
    "active": true
  },
  {
    "id": "prod-plu-heal-heal-4",
    "plu": "PLU-HEAL-HEAL-4",
    "gtin": [
      "50590461577"
    ],
    "name": "Heritage Pain Small Batch (400g)",
    "description": "Premium quality heritage pain small batch (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Pain",
    "categoryIds": [
      "cat-health-household",
      "cat-health-pain-relief"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.3,
    "displayLabels": [
      "Max 2 per order"
    ],
    "productTags": [
      "MEDICINE_LIMIT"
    ],
    "allergens": [],
    "deposit": 0,
    "multiMax": 2,
    "active": true
  },
  {
    "id": "prod-plu-heal-home-1",
    "plu": "PLU-HEAL-HOME-1",
    "gtin": [
      "50593186189"
    ],
    "name": "Heritage Eco Small Batch (100g)",
    "description": "Premium quality heritage eco small batch (100g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Eco",
    "categoryIds": [
      "cat-health-household",
      "cat-home-cleaning"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 1.95,
    "displayLabels": [
      "Small Batch"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-heal-home-2",
    "plu": "PLU-HEAL-HOME-2",
    "gtin": [
      "50593225760"
    ],
    "name": "Valley Fresh Eco Hand Selected (200g)",
    "description": "Premium quality valley fresh eco hand selected (200g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Eco",
    "categoryIds": [
      "cat-health-household",
      "cat-home-cleaning"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 3.75,
    "displayLabels": [
      "Hand Selected"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-heal-home-3",
    "plu": "PLU-HEAL-HOME-3",
    "gtin": [
      "50593389124"
    ],
    "name": "Farmhouse Eco Traditional (300g)",
    "description": "Premium quality farmhouse eco traditional (300g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Eco",
    "categoryIds": [
      "cat-health-household",
      "cat-home-cleaning"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 5.55,
    "displayLabels": [
      "Traditional"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  },
  {
    "id": "prod-plu-heal-home-4",
    "plu": "PLU-HEAL-HOME-4",
    "gtin": [
      "50593469628"
    ],
    "name": "Organic Eco Artisan (400g)",
    "description": "Premium quality organic eco artisan (400g) sourced and checked daily for peak freshness.",
    "brand": "Market Lane Eco",
    "categoryIds": [
      "cat-health-household",
      "cat-home-cleaning"
    ],
    "imageUrl": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80",
    "images": [
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80"
    ],
    "basePrice": 7.35,
    "displayLabels": [
      "Artisan"
    ],
    "productTags": [
      "FRESH"
    ],
    "allergens": [],
    "deposit": 0,
    "active": true
  }
];

export const MARKET_LANE_STORE_AVAILABILITY: Record<string, Record<string, StoreProductAvailability>> = {
  "store-market-lane-chelmsford": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.885Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.7,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "originalPrice": 7.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.95,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 36.5,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 22,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 32.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 38,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 16.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-VEG--1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-VEG--2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-VEG--3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-FRES-VEG--4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.887Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-chelmsford",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    }
  },
  "store-market-lane-moulsham": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.63,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.05,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.21,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.78,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.58,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.31,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.31,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.47,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.47,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.68,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.26,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.84,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.21,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.57,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.83,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.21,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.78,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.52,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.63,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.52,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.26,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.99,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.73,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.57,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.78,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.47,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.3,
      "originalPrice": 7.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.93,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.99,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.56,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.41,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.52,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.68,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.78,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.09,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.73,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.46,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.36,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.99,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.36,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.93,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.41,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.47,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.78,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.46,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.26,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.36,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 38.33,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 23.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 34.13,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 39.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.78,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.62,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 17.32,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.57,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.21,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.68,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.89,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.63,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.46,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.25,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.05,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-VEG--1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.72,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-VEG--2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.52,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-VEG--3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.41,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-FRES-VEG--4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.77,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.58,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.46,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.99,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.77,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.58,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.19,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.99,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.52,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.41,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.3,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.19,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.83,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.72,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.52,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.41,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.05,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.83,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.72,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.05,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.58,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.46,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.35,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.77,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.58,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.46,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.05,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.94,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.83,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-moulsham",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.72,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    }
  },
  "store-market-lane-billericay": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": true,
      "stockQuantity": 2,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": true,
      "stockQuantity": 2,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.7,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "originalPrice": 7.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.95,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.888Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 36.5,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 22,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 32.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 38,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 16.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 0.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-VEG--1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-VEG--2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-VEG--3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-FRES-VEG--4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-billericay",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    }
  },
  "store-market-lane-brentwood": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.892Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.7,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "originalPrice": 7.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.95,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 36.5,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 22,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 32.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 38,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 16.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-VEG--1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-VEG--2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-VEG--3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-FRES-VEG--4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-brentwood",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    }
  },
  "store-market-lane-shenfield": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.7,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 6.95,
      "originalPrice": 7.6,
      "isCarried": false,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 8.5,
      "isCarried": false,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.95,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 36.5,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 22,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 32.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 38,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 16.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-VEG--1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-VEG--2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-VEG--3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-FRES-VEG--4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-shenfield",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    }
  },
  "store-market-lane-wickford": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.95,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 0.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 3.4,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 3.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.7,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "originalPrice": 7.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.95,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 36.5,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 22,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 32.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 38,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 16.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 6.9,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-VEG--1",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-VEG--2",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-VEG--3",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 4.2,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-FRES-VEG--4",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 3.3,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": false,
      "stockQuantity": 0,
      "stockStatus": "OUT_OF_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-wickford",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    }
  },
  "store-market-lane-colchester": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.7,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "originalPrice": 7.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.95,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 36.5,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 22,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 32.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 38,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 16.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-VEG--1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-VEG--2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-VEG--3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-FRES-VEG--4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-colchester",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    }
  },
  "store-market-lane-maldon": {
    "PLU-BANANA-LOOSE": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BANANA-LOOSE",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-STRAWBERRY-400G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-STRAWBERRY-400G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "originalPrice": 3.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BLUEBERRY-200G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BLUEBERRY-200G",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RASPBERRY-150G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-RASPBERRY-150G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-APPLES-COX-6PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-APPLES-COX-6PK",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-AVOCADO-RIPE-2PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-AVOCADO-RIPE-2PK",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-LEMONS-UNWAXED-4PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-LEMONS-UNWAXED-4PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-VINE-400G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-TOMATOES-VINE-400G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CUCUMBER-ORGANIC": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CUCUMBER-ORGANIC",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPINACH-BABY-200G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SPINACH-BABY-200G",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALAD-WILD-ROCKET-100G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SALAD-WILD-ROCKET-100G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-POTATO-BABY-NEW-750G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-POTATO-BABY-NEW-750G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CARROTS-HERITAGE-BUNCH": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CARROTS-HERITAGE-BUNCH",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CORIANDER-LIVING-POT": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CORIANDER-LIVING-POT",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BASIL-LIVING-POT": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BASIL-LIVING-POT",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GARLIC-ISLE-OF-WIGHT": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-GARLIC-ISLE-OF-WIGHT",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GINGER-ROOT-ORGANIC-200G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-GINGER-ROOT-ORGANIC-200G",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MUSHROOMS-CHESTNUT-250G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MUSHROOMS-CHESTNUT-250G",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BELL-PEPPERS-TRIO": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BELL-PEPPERS-TRIO",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RED-ONION-NET-1KG": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-RED-ONION-NET-1KG",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-BOULE-800G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SOURDOUGH-BOULE-800G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "originalPrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SOURDOUGH-SEEDED-800G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SOURDOUGH-SEEDED-800G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CROISSANT-ALL-BUTTER-2PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CROISSANT-ALL-BUTTER-2PK",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PAIN-AU-CHOCOLAT-2PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PAIN-AU-CHOCOLAT-2PK",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BRIOCHE-BURGER-BUNS-4PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BRIOCHE-BURGER-BUNS-4PK",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAGELS-NEW-YORK-4PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BAGELS-NEW-YORK-4PK",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.7,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WHITE-FARMHOUSE-SLICED-800G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-WHITE-FARMHOUSE-SLICED-800G",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BROWN-WHOLEMEAL-SLICED-800G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BROWN-WHOLEMEAL-SLICED-800G",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FUDGE-BROWNIES-4PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FUDGE-BROWNIES-4PK",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COOKIES-CHOC-CHIP-4PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-COOKIES-CHOC-CHIP-4PK",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-WHOLE-4PT": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MILK-WHOLE-4PT",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MILK-SEMI-4PT": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MILK-SEMI-4PT",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-MILK-BARISTA-1L": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-OAT-MILK-BARISTA-1L",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.15,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-EGGS-ORGANIC-6PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-EGGS-ORGANIC-6PK",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BUTTER-SALTY-250G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BUTTER-SALTY-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHEDDAR-AGED-VINTAGE-250G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CHEDDAR-AGED-VINTAGE-250G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MOZZARELLA-DI-BUFALA-125G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MOZZARELLA-DI-BUFALA-125G",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARMIGIANO-REGGIANO-200G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PARMIGIANO-REGGIANO-200G",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GREEK-YOGURT-AUTH-500G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-GREEK-YOGURT-AUTH-500G",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OAT-YOGURT-BERRY-350G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-OAT-YOGURT-BERRY-350G",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHICKEN-BREASTS-ORGANIC-500G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CHICKEN-BREASTS-ORGANIC-500G",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "originalPrice": 7.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-RIBEYE-STEAK-DRY-AGED-250G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-RIBEYE-STEAK-DRY-AGED-250G",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SAUSAGES-CUMBERLAND-6PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SAUSAGES-CUMBERLAND-6PK",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALMON-LOCH-DUART-240G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SALMON-LOCH-DUART-240G",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PRAWNS-KING-COOKED-180G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PRAWNS-KING-COOKED-180G",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-TOFU-EXTRA-FIRM-ORGANIC-280G",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PLANT-BURGER-BEYOND-2PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PLANT-BURGER-BEYOND-2PK",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PROSCIUTTO-DI-PARMA-80G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PROSCIUTTO-DI-PARMA-80G",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-MARGHERITA-WOODFIRED": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PIZZA-MARGHERITA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.95,
      "originalPrice": 6.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIZZA-SPICY-NDUJA-WOODFIRED": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PIZZA-SPICY-NDUJA-WOODFIRED",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-TORTELLONI-TRUFFLE-250G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PASTA-TORTELLONI-TRUFFLE-250G",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-SAUCE-SLOW-BEEF-350G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PASTA-SAUCE-SLOW-BEEF-350G",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CURRY-BUTTER-CHICKEN-400G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CURRY-BUTTER-CHICKEN-400G",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PIE-STEAK-ALE-270G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PIE-STEAK-ALE-270G",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-OJ-FRESH-1L": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-JUICE-OJ-FRESH-1L",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-JUICE-GREEN-CLEANSE-330ML": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-JUICE-GREEN-CLEANSE-330ML",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-KOMBUCHA-GINGER-LEMON-330ML": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-KOMBUCHA-GINGER-LEMON-330ML",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SODA-RHUBARB-CARDAMOM-275ML": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SODA-RHUBARB-CARDAMOM-275ML",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-COFFEE-BEANS-GUATEMALA-250G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-COFFEE-BEANS-GUATEMALA-250G",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 8.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TEA-ENGLISH-BREAKFAST-50BAGS": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-TEA-ENGLISH-BREAKFAST-50BAGS",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-SEA-SALT-CIDER-150G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CRISPS-SEA-SALT-CIDER-150G",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CRISPS-TRUFFLE-ROSEMARY-150G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CRISPS-TRUFFLE-ROSEMARY-150G",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-CHOC-DARK-SEA-SALT-70G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-CHOC-DARK-SEA-SALT-70G",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.25,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-NUTS-SMOKED-ALMONDS-120G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-NUTS-SMOKED-ALMONDS-120G",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BISCUITS-ALL-BUTTER-SHORTBREAD-160G",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-GIN-COTSWOLDS-70CL": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-GIN-COTSWOLDS-70CL",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 36.5,
      "originalPrice": 40,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-CHABLIS-ORGANIC-75CL": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-WINE-CHABLIS-ORGANIC-75CL",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 22,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-WINE-RIOJA-RESERVA-75CL": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-WINE-RIOJA-RESERVA-75CL",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 32.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SPARKLING-NYETIMBER-CLASSIC-75CL",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 38,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-VERDANT-LIGHTBULB-440ML": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BEER-VERDANT-LIGHTBULB-440ML",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-DEYA-STEADY-ROLLING-500ML": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BEER-DEYA-STEADY-ROLLING-500ML",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-OIL-EVOO-FRANTOIO-500ML": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-OIL-EVOO-FRANTOIO-500ML",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 16.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PASTA-BRONZE-RIGATONI-500G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PASTA-BRONZE-RIGATONI-500G",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-TOMATOES-SAN-MARZANO-DOP-400G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-TOMATOES-SAN-MARZANO-DOP-400G",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SALT-MALDON-SEA-SALT-250G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SALT-MALDON-SEA-SALT-250G",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PESTO-GENOVESE-ORGANIC-190G": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PESTO-GENOVESE-ORGANIC-190G",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PARACETAMOL-500MG-16PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PARACETAMOL-500MG-16PK",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-IBUPROFEN-200MG-16PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-IBUPROFEN-200MG-16PK",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 0.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-ECOVER-WASHING-UP-LIME-450ML": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-ECOVER-WASHING-UP-LIME-450ML",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAMBOO-KITCHEN-ROLL-2PK": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BAMBOO-KITCHEN-ROLL-2PK",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-FRUI-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-FRUI-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-FRUI-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "originalPrice": 8.28,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-FRUI-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-FRUI-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-VEG--1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-VEG--2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-VEG--3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "originalPrice": 5.04,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-FRES-VEG--4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-FRES-VEG--4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BAKE-BAKE-1",
      "inStock": true,
      "stockQuantity": 51,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BAKE-BAKE-2",
      "inStock": true,
      "stockQuantity": 58,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BAKE-BAKE-3",
      "inStock": true,
      "stockQuantity": 65,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "originalPrice": 3.96,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BAKE-BAKE-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BAKE-BAKE-4",
      "inStock": true,
      "stockQuantity": 72,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DAIR-DAIR-1",
      "inStock": true,
      "stockQuantity": 39,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DAIR-DAIR-2",
      "inStock": true,
      "stockQuantity": 46,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DAIR-DAIR-3",
      "inStock": true,
      "stockQuantity": 53,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "originalPrice": 7.74,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DAIR-DAIR-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DAIR-DAIR-4",
      "inStock": true,
      "stockQuantity": 60,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MEAT-MEAT-1",
      "inStock": true,
      "stockQuantity": 67,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MEAT-MEAT-2",
      "inStock": true,
      "stockQuantity": 74,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MEAT-MEAT-3",
      "inStock": true,
      "stockQuantity": 41,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.85,
      "originalPrice": 3.42,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-MEAT-MEAT-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-MEAT-MEAT-4",
      "inStock": true,
      "stockQuantity": 48,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-READ-READ-1",
      "inStock": true,
      "stockQuantity": 55,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-READ-READ-2",
      "inStock": true,
      "stockQuantity": 62,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-READ-READ-3",
      "inStock": true,
      "stockQuantity": 69,
      "stockStatus": "IN_STOCK",
      "storePrice": 6,
      "originalPrice": 7.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-READ-READ-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-READ-READ-4",
      "inStock": true,
      "stockQuantity": 36,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DRIN-DRIN-1",
      "inStock": true,
      "stockQuantity": 43,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DRIN-DRIN-2",
      "inStock": true,
      "stockQuantity": 50,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DRIN-DRIN-3",
      "inStock": true,
      "stockQuantity": 57,
      "stockStatus": "IN_STOCK",
      "storePrice": 2.4,
      "originalPrice": 2.88,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-DRIN-DRIN-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-DRIN-DRIN-4",
      "inStock": true,
      "stockQuantity": 64,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.2,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SNAC-SNAC-1",
      "inStock": true,
      "stockQuantity": 71,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SNAC-SNAC-2",
      "inStock": true,
      "stockQuantity": 38,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SNAC-SNAC-3",
      "inStock": true,
      "stockQuantity": 45,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-SNAC-SNAC-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-SNAC-SNAC-4",
      "inStock": true,
      "stockQuantity": 52,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BEER-ALCO-1",
      "inStock": true,
      "stockQuantity": 59,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BEER-ALCO-2",
      "inStock": true,
      "stockQuantity": 66,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BEER-ALCO-3",
      "inStock": true,
      "stockQuantity": 73,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "originalPrice": 2.34,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-BEER-ALCO-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-BEER-ALCO-4",
      "inStock": true,
      "stockQuantity": 40,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PANT-PANT-1",
      "inStock": true,
      "stockQuantity": 47,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PANT-PANT-2",
      "inStock": true,
      "stockQuantity": 54,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PANT-PANT-3",
      "inStock": true,
      "stockQuantity": 61,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.1,
      "originalPrice": 6.12,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-PANT-PANT-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-PANT-PANT-4",
      "inStock": true,
      "stockQuantity": 68,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.9,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HEAL-1",
      "inStock": true,
      "stockQuantity": 35,
      "stockStatus": "IN_STOCK",
      "storePrice": 4.65,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HEAL-2",
      "inStock": true,
      "stockQuantity": 42,
      "stockStatus": "IN_STOCK",
      "storePrice": 6.45,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HEAL-3",
      "inStock": true,
      "stockQuantity": 49,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.5,
      "originalPrice": 1.8,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HEAL-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HEAL-4",
      "inStock": true,
      "stockQuantity": 56,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.3,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-1": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HOME-1",
      "inStock": true,
      "stockQuantity": 63,
      "stockStatus": "IN_STOCK",
      "storePrice": 1.95,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-2": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HOME-2",
      "inStock": true,
      "stockQuantity": 70,
      "stockStatus": "IN_STOCK",
      "storePrice": 3.75,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-3": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HOME-3",
      "inStock": true,
      "stockQuantity": 37,
      "stockStatus": "IN_STOCK",
      "storePrice": 5.55,
      "originalPrice": 6.66,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    },
    "PLU-HEAL-HOME-4": {
      "storeId": "store-market-lane-maldon",
      "plu": "PLU-HEAL-HOME-4",
      "inStock": true,
      "stockQuantity": 44,
      "stockStatus": "IN_STOCK",
      "storePrice": 7.35,
      "isCarried": true,
      "lastSyncAt": "2026-09-17T09:10:52.893Z"
    }
  }
};
