// Generator script to produce realistic, deterministic Market Lane retail dataset
import fs from 'fs';

interface CategoryDef {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  iconName: string;
  subcategories: Array<{ id: string; name: string }>;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'cat-fresh-produce',
    name: 'Fresh Produce',
    description: 'Crisp fruit, organic vegetables, fresh herbs and salads',
    imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&auto=format&fit=crop&q=80',
    iconName: 'Apple',
    subcategories: [
      { id: 'cat-fruit-berries', name: 'Berries, Cherries & Grapes' },
      { id: 'cat-fruit-citrus', name: 'Citrus, Apples & Pears' },
      { id: 'cat-fruit-tropical', name: 'Bananas & Tropical Fruit' },
      { id: 'cat-veg-salads', name: 'Salad, Tomatoes & Cucumbers' },
      { id: 'cat-veg-roots', name: 'Root Vegetables & Potatoes' },
      { id: 'cat-veg-herbs', name: 'Fresh Culinary Herbs' },
    ],
  },
  {
    id: 'cat-bakery',
    name: 'Bakery & Bread',
    description: 'Fresh sourdough, morning pastries, artisanal loaves and rolls',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
    iconName: 'Wheat',
    subcategories: [
      { id: 'cat-bakery-sourdough', name: 'Artisan Sourdough & Specialty Loaves' },
      { id: 'cat-bakery-sliced', name: 'Everyday Sliced Bread & Wraps' },
      { id: 'cat-bakery-pastries', name: 'Croissants & Breakfast Pastries' },
      { id: 'cat-bakery-buns', name: 'Brioche, Rolls & Bagels' },
      { id: 'cat-bakery-sweets', name: 'Cakes, Cookies & Brownies' },
    ],
  },
  {
    id: 'cat-dairy-eggs',
    name: 'Dairy, Eggs & Chilled',
    description: 'Organic milk, farmhouse cheeses, free-range eggs and yogurts',
    imageUrl: 'https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=400&auto=format&fit=crop&q=80',
    iconName: 'Egg',
    subcategories: [
      { id: 'cat-dairy-milk', name: 'Fresh Milk, Plant Milks & Cream' },
      { id: 'cat-dairy-butter', name: 'Farmhouse Butter & Spreads' },
      { id: 'cat-dairy-eggs', name: 'Free-Range & Organic Eggs' },
      { id: 'cat-dairy-cheese', name: 'Cheddar, Continental & Artisan Cheese' },
      { id: 'cat-dairy-yogurt', name: 'Greek, Live Culture & Natural Yogurt' },
    ],
  },
  {
    id: 'cat-meat-fish',
    name: 'Meat, Seafood & Plant-Based',
    description: 'Grass-fed beef, organic poultry, sustainable fish and vegetarian alternatives',
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&auto=format&fit=crop&q=80',
    iconName: 'Beef',
    subcategories: [
      { id: 'cat-meat-poultry', name: 'Free-Range Chicken & Turkey' },
      { id: 'cat-meat-beef-pork', name: 'British Grass-Fed Beef & Pork' },
      { id: 'cat-meat-fish', name: 'Fresh Salmon, White Fish & Prawns' },
      { id: 'cat-meat-plant', name: 'Tofu, Tempeh & Plant-Based Burgers' },
      { id: 'cat-meat-charcuterie', name: 'Prosciutto, Salami & Cooked Hams' },
    ],
  },
  {
    id: 'cat-ready-meals',
    name: 'Prepared Meals & Pizza',
    description: 'Woodfired pizzas, fresh pasta, handmade soups and evening dishes',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80',
    iconName: 'Pizza',
    subcategories: [
      { id: 'cat-ready-pizza', name: 'Fresh Stonebaked Pizzas' },
      { id: 'cat-ready-pasta', name: 'Fresh Filled Pasta & Sauces' },
      { id: 'cat-ready-curry', name: 'Indian, Thai & Asian Ready Meals' },
      { id: 'cat-ready-pies', name: 'Traditional Hand-Crimped Pies' },
      { id: 'cat-ready-soups', name: 'Fresh Chilled Soups & Dips' },
    ],
  },
  {
    id: 'cat-drinks',
    name: 'Drinks & Beverages',
    description: 'Cold-pressed juices, sodas, kombucha, artisan coffee & English teas',
    imageUrl: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=400&auto=format&fit=crop&q=80',
    iconName: 'Coffee',
    subcategories: [
      { id: 'cat-drinks-cold-juice', name: 'Cold-Pressed Juices & Smoothies' },
      { id: 'cat-drinks-sodas', name: 'Craft Sparkling Sodas & Tonics' },
      { id: 'cat-drinks-kombucha', name: 'Raw Fermented Kombucha & Kefir' },
      { id: 'cat-drinks-water', name: 'Spring Waters & Sparkling Waters' },
      { id: 'cat-drinks-coffee-tea', name: 'Specialty Coffee Beans & Loose Leaf Tea' },
    ],
  },
  {
    id: 'cat-snacks-confectionery',
    name: 'Snacks, Crisps & Sweet Treats',
    description: 'Handcooked crisps, single-origin chocolate, roasted nuts and biscuits',
    imageUrl: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400&auto=format&fit=crop&q=80',
    iconName: 'Cookie',
    subcategories: [
      { id: 'cat-snacks-crisps', name: 'Handcooked Crisps & Popcorn' },
      { id: 'cat-snacks-chocolate', name: 'Artisan Dark & Milk Chocolate' },
      { id: 'cat-snacks-nuts', name: 'Roasted Almonds, Cashews & Dried Fruit' },
      { id: 'cat-snacks-biscuits', name: 'Shortbread, Oatcakes & Sweet Biscuits' },
      { id: 'cat-snacks-sweets', name: 'Gourmet Gummies & Confectionery' },
    ],
  },
  {
    id: 'cat-beer-wine-spirits',
    name: 'Beer, Wine & Fine Spirits',
    description: 'Natural wines, craft IPAs, English sparkling and botanical spirits (18+)',
    imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&auto=format&fit=crop&q=80',
    iconName: 'Wine',
    subcategories: [
      { id: 'cat-alcohol-wine-red', name: 'Natural & Organic Red Wine' },
      { id: 'cat-alcohol-wine-white', name: 'Crisp White & Rosé Wine' },
      { id: 'cat-alcohol-sparkling', name: 'English Sparkling & Champagne' },
      { id: 'cat-alcohol-craft-beer', name: 'Craft IPAs, Pale Ales & Stouts' },
      { id: 'cat-alcohol-spirits', name: 'Artisan Gin, Whisky, Rum & Aperitifs' },
    ],
  },
  {
    id: 'cat-pantry-essentials',
    name: 'Pantry, Oils & Condiments',
    description: 'Extra virgin olive oil, aged balsamic, pasta, organic grains and seasonings',
    imageUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400&auto=format&fit=crop&q=80',
    iconName: 'Soup',
    subcategories: [
      { id: 'cat-pantry-oils', name: 'Extra Virgin Olive Oil & Vinegars' },
      { id: 'cat-pantry-grains', name: 'Bronze-Die Dried Pasta, Rice & Grains' },
      { id: 'cat-pantry-sauces', name: 'Passata, Pestos & Chutneys' },
      { id: 'cat-pantry-spices', name: 'Sea Salts, Peppers & Organic Spices' },
      { id: 'cat-pantry-canned', name: 'Organic Pulses, Beans & Tomatoes' },
    ],
  },
  {
    id: 'cat-health-household',
    name: 'Pharmacy, Wellness & Home',
    description: 'Over-the-counter pain relief, cold care, eco cleaning & toiletries',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
    iconName: 'HeartPulse',
    subcategories: [
      { id: 'cat-health-pain-relief', name: 'Pain Relief & Paracetamol (Medicine limit 2)' },
      { id: 'cat-health-cold-flu', name: 'Cold & Flu, Throat Lozenges' },
      { id: 'cat-health-first-aid', name: 'First Aid, Bandages & Antiseptics' },
      { id: 'cat-home-cleaning', name: 'Eco Dish Soap & Multi-Surface Sprays' },
      { id: 'cat-home-paper', name: 'Bamboo Kitchen Roll & Toilet Tissue' },
    ],
  },
];

export { CATEGORIES };
