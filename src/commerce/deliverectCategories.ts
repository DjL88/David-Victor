import { Category } from './models';

/**
 * Deliverect Commerce API 3-Level Category Specification:
 * - Level 1: Department (e.g. Fresh Produce, Bakery & Bread, Beer & Wine)
 * - Level 2: Aisle / Subcategory (e.g. Berries & Grapes, Artisan Sourdough)
 * - Level 3: Shelf / Sub-subcategory (e.g. Strawberries & Raspberries, White Sourdough Boules)
 */
export const DELIVERECT_3_LEVEL_CATEGORIES: Category[] = [
  {
    id: 'cat-fresh-produce',
    name: 'Fresh Produce',
    description: 'Crisp fruit, organic vegetables, fresh herbs and salads',
    imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80',
    iconName: 'Apple',
    level: 1,
    subcategories: [
      {
        id: 'cat-fruit-berries',
        name: 'Berries, Cherries & Grapes',
        parentId: 'cat-fresh-produce',
        level: 2,
        subcategories: [
          { id: 'cat-fruit-strawberries', name: 'Fresh Strawberries & Raspberries', parentId: 'cat-fruit-berries', level: 3 },
          { id: 'cat-fruit-blueberries', name: 'Organic Blueberries & Blackberries', parentId: 'cat-fruit-berries', level: 3 },
          { id: 'cat-fruit-cherries-grapes', name: 'Table Grapes & Sweet Cherries', parentId: 'cat-fruit-berries', level: 3 },
        ],
      },
      {
        id: 'cat-fruit-citrus',
        name: 'Citrus, Apples & Pears',
        parentId: 'cat-fresh-produce',
        level: 2,
        subcategories: [
          { id: 'cat-fruit-apples', name: 'Crisp Eating Apples & Cooking Apples', parentId: 'cat-fruit-citrus', level: 3 },
          { id: 'cat-fruit-citrus-oranges', name: 'Oranges, Lemons, Limes & Grapefruits', parentId: 'cat-fruit-citrus', level: 3 },
        ],
      },
      {
        id: 'cat-fruit-tropical',
        name: 'Bananas & Tropical Fruit',
        parentId: 'cat-fresh-produce',
        level: 2,
        subcategories: [
          { id: 'cat-fruit-tropical-bananas', name: 'Fairtrade & Organic Bananas', parentId: 'cat-fruit-tropical', level: 3 },
          { id: 'cat-fruit-tropical-avocados', name: 'Ready-to-Eat Hass Avocados & Mangoes', parentId: 'cat-fruit-tropical', level: 3 },
        ],
      },
      {
        id: 'cat-veg-salads',
        name: 'Salad, Tomatoes & Cucumbers',
        parentId: 'cat-fresh-produce',
        level: 2,
        subcategories: [
          { id: 'cat-veg-leaves', name: 'Wild Rocket, Baby Spinach & Mixed Leaves', parentId: 'cat-veg-salads', level: 3 },
          { id: 'cat-veg-tomatoes', name: 'Heritage Vine Tomatoes & Baby Cucumbers', parentId: 'cat-veg-salads', level: 3 },
        ],
      },
      {
        id: 'cat-veg-roots',
        name: 'Root Vegetables & Potatoes',
        parentId: 'cat-fresh-produce',
        level: 2,
        subcategories: [
          { id: 'cat-veg-potatoes', name: 'British Baby & Roasting Potatoes', parentId: 'cat-veg-roots', level: 3 },
          { id: 'cat-veg-carrots', name: 'Heritage Carrots, Onions & Garlic', parentId: 'cat-veg-roots', level: 3 },
        ],
      },
      {
        id: 'cat-veg-herbs',
        name: 'Fresh Culinary Herbs',
        parentId: 'cat-fresh-produce',
        level: 2,
        subcategories: [
          { id: 'cat-veg-herbs-living', name: 'Living Potted Basil, Mint & Coriander', parentId: 'cat-veg-herbs', level: 3 },
          { id: 'cat-veg-herbs-fresh', name: 'Cut Rosemary, Thyme & Flat Leaf Parsley', parentId: 'cat-veg-herbs', level: 3 },
        ],
      },
    ],
  },
  {
    id: 'cat-bakery',
    name: 'Bakery & Bread',
    description: 'Fresh sourdough, morning pastries, artisanal loaves and rolls',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
    iconName: 'Wheat',
    level: 1,
    subcategories: [
      {
        id: 'cat-bakery-sourdough',
        name: 'Artisan Sourdough & Specialty Loaves',
        parentId: 'cat-bakery',
        level: 2,
        subcategories: [
          { id: 'cat-bakery-sourdough-white', name: 'San Francisco & Classic White Sourdough', parentId: 'cat-bakery-sourdough', level: 3 },
          { id: 'cat-bakery-sourdough-seeded', name: 'Seeded Rye & Ancient Grain Sourdough', parentId: 'cat-bakery-sourdough', level: 3 },
        ],
      },
      {
        id: 'cat-bakery-sliced',
        name: 'Everyday Sliced Bread & Wraps',
        parentId: 'cat-bakery',
        level: 2,
        subcategories: [
          { id: 'cat-bakery-sliced-white', name: 'Farmhouse White & Wholemeal Loaves', parentId: 'cat-bakery-sliced', level: 3 },
          { id: 'cat-bakery-sliced-wraps', name: 'Flatbreads, Pitta & Tortilla Wraps', parentId: 'cat-bakery-sliced', level: 3 },
        ],
      },
      {
        id: 'cat-bakery-pastries',
        name: 'Croissants & Breakfast Pastries',
        parentId: 'cat-bakery',
        level: 2,
        subcategories: [
          { id: 'cat-bakery-pastries-croissants', name: 'All Butter Croissants & Pain au Chocolat', parentId: 'cat-bakery-pastries', level: 3 },
          { id: 'cat-bakery-pastries-danish', name: 'Almond Croissants & Cinnamon Swirls', parentId: 'cat-bakery-pastries', level: 3 },
        ],
      },
      {
        id: 'cat-bakery-buns',
        name: 'Brioche, Rolls & Bagels',
        parentId: 'cat-bakery',
        level: 2,
        subcategories: [
          { id: 'cat-bakery-buns-brioche', name: 'Glazed Brioche Burger Buns', parentId: 'cat-bakery-buns', level: 3 },
          { id: 'cat-bakery-buns-bagels', name: 'New York Style Seeded Bagels', parentId: 'cat-bakery-buns', level: 3 },
        ],
      },
      {
        id: 'cat-bakery-sweets',
        name: 'Cakes, Cookies & Brownies',
        parentId: 'cat-bakery',
        level: 2,
        subcategories: [
          { id: 'cat-bakery-sweets-brownies', name: 'Belgian Chocolate Brownies & Flapjacks', parentId: 'cat-bakery-sweets', level: 3 },
          { id: 'cat-bakery-sweets-cakes', name: 'Artisan Lemon Drizzle & Carrot Cakes', parentId: 'cat-bakery-sweets', level: 3 },
        ],
      },
    ],
  },
  {
    id: 'cat-dairy-eggs',
    name: 'Dairy, Eggs & Chilled',
    description: 'Organic milk, farmhouse cheeses, free-range eggs and yogurts',
    imageUrl: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80',
    iconName: 'Egg',
    level: 1,
    subcategories: [
      {
        id: 'cat-dairy-milk',
        name: 'Fresh Milk, Plant Milks & Cream',
        parentId: 'cat-dairy-eggs',
        level: 2,
        subcategories: [
          { id: 'cat-dairy-milk-fresh', name: 'Whole & Semi-Skimmed Fresh Milk', parentId: 'cat-dairy-milk', level: 3 },
          { id: 'cat-dairy-milk-plant', name: 'Oat, Almond & Barista Plant Milks', parentId: 'cat-dairy-milk', level: 3 },
          { id: 'cat-dairy-milk-cream', name: 'Double Cream & Crème Fraîche', parentId: 'cat-dairy-milk', level: 3 },
        ],
      },
      {
        id: 'cat-dairy-butter',
        name: 'Farmhouse Butter & Spreads',
        parentId: 'cat-dairy-eggs',
        level: 2,
        subcategories: [
          { id: 'cat-dairy-butter-salted', name: 'Sea Salted Farmhouse Butter', parentId: 'cat-dairy-butter', level: 3 },
          { id: 'cat-dairy-butter-plant', name: 'Olive Oil & Plant-Based Spreads', parentId: 'cat-dairy-butter', level: 3 },
        ],
      },
      {
        id: 'cat-dairy-eggs-sub',
        name: 'Free-Range & Organic Eggs',
        parentId: 'cat-dairy-eggs',
        level: 2,
        subcategories: [
          { id: 'cat-dairy-eggs-large', name: 'Large British Free-Range Eggs', parentId: 'cat-dairy-eggs-sub', level: 3 },
          { id: 'cat-dairy-eggs-heritage', name: 'Organic Heritage Blue & Duck Eggs', parentId: 'cat-dairy-eggs-sub', level: 3 },
        ],
      },
      {
        id: 'cat-dairy-cheese',
        name: 'Cheddar, Continental & Artisan Cheese',
        parentId: 'cat-dairy-eggs',
        level: 2,
        subcategories: [
          { id: 'cat-dairy-cheese-cheddar', name: 'Cave Aged Vintage Cheddar', parentId: 'cat-dairy-cheese', level: 3 },
          { id: 'cat-dairy-cheese-continental', name: 'Somerset Brie, Blue & Parmesan', parentId: 'cat-dairy-cheese', level: 3 },
        ],
      },
      {
        id: 'cat-dairy-yogurt',
        name: 'Greek, Live Culture & Natural Yogurt',
        parentId: 'cat-dairy-eggs',
        level: 2,
        subcategories: [
          { id: 'cat-dairy-yogurt-greek', name: 'Authentic 10% Greek Strained Yogurt', parentId: 'cat-dairy-yogurt', level: 3 },
          { id: 'cat-dairy-yogurt-kefir', name: 'Organic Kefir Drinks & Fruit Pots', parentId: 'cat-dairy-yogurt', level: 3 },
        ],
      },
    ],
  },
  {
    id: 'cat-meat-fish',
    name: 'Meat, Seafood & Plant-Based',
    description: 'Grass-fed beef, organic poultry, sustainable fish and vegetarian alternatives',
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80',
    iconName: 'Beef',
    level: 1,
    subcategories: [
      {
        id: 'cat-meat-poultry',
        name: 'Free-Range Chicken & Turkey',
        parentId: 'cat-meat-fish',
        level: 2,
        subcategories: [
          { id: 'cat-meat-poultry-chicken', name: 'Corn-Fed Free Range Chicken Fillets', parentId: 'cat-meat-poultry', level: 3 },
        ],
      },
      {
        id: 'cat-meat-beef-pork',
        name: 'British Grass-Fed Beef & Pork',
        parentId: 'cat-meat-fish',
        level: 2,
        subcategories: [
          { id: 'cat-meat-beef-steaks', name: '28-Day Dry Aged Ribeye & Sirloin', parentId: 'cat-meat-beef-pork', level: 3 },
          { id: 'cat-meat-pork-sausages', name: 'Cumberland Pork Sausages & Smoked Bacon', parentId: 'cat-meat-beef-pork', level: 3 },
        ],
      },
      {
        id: 'cat-meat-fish-sub',
        name: 'Fresh Salmon, White Fish & Prawns',
        parentId: 'cat-meat-fish',
        level: 2,
        subcategories: [
          { id: 'cat-meat-fish-salmon', name: 'Scottish Salmon Fillets & Smoked Salmon', parentId: 'cat-meat-fish-sub', level: 3 },
        ],
      },
      {
        id: 'cat-meat-plant',
        name: 'Tofu, Tempeh & Plant-Based Burgers',
        parentId: 'cat-meat-fish',
        level: 2,
        subcategories: [
          { id: 'cat-meat-plant-burgers', name: 'Organic Smoked Tofu & Plant Burgers', parentId: 'cat-meat-plant', level: 3 },
        ],
      },
    ],
  },
  {
    id: 'cat-ready-meals',
    name: 'Prepared Meals & Pizza',
    description: 'Woodfired pizzas, fresh pasta, handmade soups and evening dishes',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80',
    iconName: 'Pizza',
    level: 1,
    subcategories: [
      {
        id: 'cat-ready-pizza',
        name: 'Fresh Stonebaked Pizzas',
        parentId: 'cat-ready-meals',
        level: 2,
        subcategories: [
          { id: 'cat-ready-pizza-sourdough', name: 'Sourdough Margherita & Spicy Salame', parentId: 'cat-ready-pizza', level: 3 },
        ],
      },
      {
        id: 'cat-ready-pasta',
        name: 'Fresh Filled Pasta & Sauces',
        parentId: 'cat-ready-meals',
        level: 2,
        subcategories: [
          { id: 'cat-ready-pasta-fresh', name: 'Ricotta Tortelloni & Slow Cooked Ragu', parentId: 'cat-ready-pasta', level: 3 },
        ],
      },
    ],
  },
  {
    id: 'cat-drinks',
    name: 'Drinks & Beverages',
    description: 'Cold-pressed juices, sodas, kombucha, artisan coffee & English teas',
    imageUrl: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80',
    iconName: 'Coffee',
    level: 1,
    subcategories: [
      {
        id: 'cat-drinks-cold-juice',
        name: 'Cold-Pressed Juices & Smoothies',
        parentId: 'cat-drinks',
        level: 2,
        subcategories: [
          { id: 'cat-drinks-cold-green', name: 'Cold-Pressed Green Juice & Cleanse', parentId: 'cat-drinks-cold-juice', level: 3 },
          { id: 'cat-drinks-cold-orange', name: 'Freshly Squeezed Valencia Orange', parentId: 'cat-drinks-cold-juice', level: 3 },
        ],
      },
      {
        id: 'cat-drinks-sodas',
        name: 'Craft Sparkling Sodas & Tonics',
        parentId: 'cat-drinks',
        level: 2,
        subcategories: [
          { id: 'cat-drinks-sodas-botanicals', name: 'Artisan Ginger Beer & Botanical Sodas', parentId: 'cat-drinks-sodas', level: 3 },
        ],
      },
      {
        id: 'cat-drinks-kombucha',
        name: 'Raw Fermented Kombucha & Kefir',
        parentId: 'cat-drinks',
        level: 2,
        subcategories: [
          { id: 'cat-drinks-kombucha-sparkling', name: 'Live Ginger & Passionfruit Kombucha', parentId: 'cat-drinks-kombucha', level: 3 },
        ],
      },
      {
        id: 'cat-drinks-coffee-tea',
        name: 'Specialty Coffee Beans & Loose Leaf Tea',
        parentId: 'cat-drinks',
        level: 2,
        subcategories: [
          { id: 'cat-drinks-coffee-beans', name: 'Single Origin Whole Bean Espresso', parentId: 'cat-drinks-coffee-tea', level: 3 },
        ],
      },
    ],
  },
  {
    id: 'cat-snacks-confectionery',
    name: 'Snacks, Crisps & Sweet Treats',
    description: 'Handcooked crisps, single-origin chocolate, roasted nuts and biscuits',
    imageUrl: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    iconName: 'Cookie',
    level: 1,
    subcategories: [
      {
        id: 'cat-snacks-crisps',
        name: 'Handcooked Crisps & Popcorn',
        parentId: 'cat-snacks-confectionery',
        level: 2,
        subcategories: [
          { id: 'cat-snacks-crisps-sea-salt', name: 'Handcooked Sea Salt & Cider Vinegar Crisps', parentId: 'cat-snacks-crisps', level: 3 },
        ],
      },
      {
        id: 'cat-snacks-chocolate',
        name: 'Artisan Dark & Milk Chocolate',
        parentId: 'cat-snacks-confectionery',
        level: 2,
        subcategories: [
          { id: 'cat-snacks-chocolate-bars', name: 'Single Origin 70% Dark Chocolate', parentId: 'cat-snacks-chocolate', level: 3 },
        ],
      },
    ],
  },
  {
    id: 'cat-beer-wine-spirits',
    name: 'Beer, Wine & Fine Spirits',
    description: 'Sommelier-curated natural wines, local craft beers and independent distillery spirits',
    imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80',
    iconName: 'Wine',
    level: 1,
    subcategories: [
      {
        id: 'cat-alcohol-craft-beer',
        name: 'Craft IPAs, Pale Ales & Stouts',
        parentId: 'cat-beer-wine-spirits',
        level: 2,
        subcategories: [
          { id: 'cat-alcohol-craft-beer-ipa', name: 'Hazy New England & Double IPAs', parentId: 'cat-alcohol-craft-beer', level: 3 },
          { id: 'cat-alcohol-craft-beer-lager', name: 'Crisp Craft Pilsners & German Lagers', parentId: 'cat-alcohol-craft-beer', level: 3 },
        ],
      },
      {
        id: 'cat-alcohol-wine',
        name: 'Red, White & Rosé Fine Wine',
        parentId: 'cat-beer-wine-spirits',
        level: 2,
        subcategories: [
          { id: 'cat-alcohol-wine-red', name: 'Biodynamic Pinot Noir & Malbec', parentId: 'cat-alcohol-wine', level: 3 },
          { id: 'cat-alcohol-wine-white', name: 'Marlborough Sauvignon & Chablis', parentId: 'cat-alcohol-wine', level: 3 },
        ],
      },
      {
        id: 'cat-alcohol-sparkling',
        name: 'Champagne & English Sparkling',
        parentId: 'cat-beer-wine-spirits',
        level: 2,
        subcategories: [
          { id: 'cat-alcohol-sparkling-english', name: 'Traditional Method English Sparkling Wine', parentId: 'cat-alcohol-sparkling', level: 3 },
        ],
      },
      {
        id: 'cat-alcohol-spirits',
        name: 'Artisan Gin, Rum & Single Malts',
        parentId: 'cat-beer-wine-spirits',
        level: 2,
        subcategories: [
          { id: 'cat-alcohol-spirits-gin', name: 'Botanical Cotswolds Dry Gin 70cl', parentId: 'cat-alcohol-spirits', level: 3 },
        ],
      },
    ],
  },
];
