export interface DrinkSize {
  size: 'S' | 'M' | 'L';
  label: string;
  price: number;
  extra: number;
}

export interface MilkOption {
  id: string;
  label: string;
  extra: number;
  tag: string;
}

export interface ToppingOption {
  id: string;
  label: string;
  price: number;
}

export interface Drink {
  id: string;
  name: string;
  subtitle: string;
  category: 'All drinks' | 'Espresso' | 'Milk coffee' | 'Cold & iced' | 'Tea';
  basePrice: number;
  image: string;
  largeImage?: string;
  bestseller?: boolean;
  description: string;
  tags: string[];
  sizes: DrinkSize[];
  milkOptions: MilkOption[];
  toppings: ToppingOption[];
}

export const DRINKS: Drink[] = [
  {
    id: 'brown-sugar-latte',
    name: 'Brown Sugar Latte',
    subtitle: 'Espresso · oat milk option',
    category: 'Milk coffee',
    basePrice: 59000,
    image: '/images/drinks/brown-sugar-latte.png',
    largeImage: '/images/drinks/brown-sugar-latte.png',
    bestseller: true,
    description: 'Rich espresso meets mellow brown sugar and silky milk. Comforting, balanced, and made just the way you like.',
    tags: ['Freshly made to order', 'Contains caffeine', 'Oat milk available'],
    sizes: [
      { size: 'S', label: 'Regular', price: 59000, extra: 0 },
      { size: 'M', label: 'Medium', price: 62000, extra: 3000 },
      { size: 'L', label: 'Large', price: 65000, extra: 6000 },
    ],
    milkOptions: [
      { id: 'dairy', label: 'Dairy milk', extra: 0, tag: 'Included' },
      { id: 'oat', label: 'Oat milk', extra: 0, tag: 'Included' },
    ],
    toppings: [
      { id: 'extra-shot', label: 'Extra shot', price: 10000 },
      { id: 'caramel-drizzle', label: 'Caramel drizzle', price: 5000 },
    ],
  },
  {
    id: 'vanilla-cold-brew',
    name: 'Vanilla Cold Brew',
    subtitle: 'Slow-steeped · smooth',
    category: 'Cold & iced',
    basePrice: 55000,
    image: '/images/drinks/vanilla-cold-brew.png',
    largeImage: '/images/drinks/vanilla-cold-brew.png',
    bestseller: false,
    description: 'Slow-steeped for 16 hours for a silky, naturally sweet sip infused with aromatic Madagascar vanilla.',
    tags: ['Cold steeped', 'Low acidity', 'Refreshing'],
    sizes: [
      { size: 'S', label: 'Regular', price: 55000, extra: 0 },
      { size: 'M', label: 'Medium', price: 58000, extra: 3000 },
      { size: 'L', label: 'Large', price: 61000, extra: 6000 },
    ],
    milkOptions: [
      { id: 'dairy', label: 'Dairy milk', extra: 0, tag: 'Included' },
      { id: 'oat', label: 'Oat milk', extra: 0, tag: 'Included' },
    ],
    toppings: [
      { id: 'extra-shot', label: 'Extra shot', price: 10000 },
      { id: 'caramel-drizzle', label: 'Caramel drizzle', price: 5000 },
    ],
  },
  {
    id: 'flat-white',
    name: 'Flat White',
    subtitle: 'Double shot · silky milk',
    category: 'Espresso',
    basePrice: 49000,
    image: '/images/drinks/flat-white.png',
    largeImage: '/images/drinks/flat-white.png',
    bestseller: false,
    description: 'Expertly pulled double espresso topped with a velvety micro-foam layer for coffee purists.',
    tags: ['Double espresso', 'Velvety micro-foam', 'Hot or Iced'],
    sizes: [
      { size: 'S', label: 'Regular', price: 49000, extra: 0 },
      { size: 'M', label: 'Medium', price: 52000, extra: 3000 },
      { size: 'L', label: 'Large', price: 55000, extra: 6000 },
    ],
    milkOptions: [
      { id: 'dairy', label: 'Dairy milk', extra: 0, tag: 'Included' },
      { id: 'oat', label: 'Oat milk', extra: 0, tag: 'Included' },
    ],
    toppings: [
      { id: 'extra-shot', label: 'Extra shot', price: 10000 },
      { id: 'caramel-drizzle', label: 'Caramel drizzle', price: 5000 },
    ],
  },
  {
    id: 'matcha-cloud',
    name: 'Matcha Cloud',
    subtitle: 'Ceremonial matcha · creamy',
    category: 'Tea',
    basePrice: 62000,
    image: '/images/drinks/matcha-cloud.png',
    largeImage: '/images/drinks/matcha-cloud.png',
    bestseller: false,
    description: 'Stone-ground ceremonial Uji matcha whisked fresh and layered over chilled creamy oat foam.',
    tags: ['Ceremonial grade', 'Rich antioxidants', 'Oat cloud'],
    sizes: [
      { size: 'S', label: 'Regular', price: 62000, extra: 0 },
      { size: 'M', label: 'Medium', price: 65000, extra: 3000 },
      { size: 'L', label: 'Large', price: 68000, extra: 6000 },
    ],
    milkOptions: [
      { id: 'dairy', label: 'Dairy milk', extra: 0, tag: 'Included' },
      { id: 'oat', label: 'Oat milk', extra: 0, tag: 'Included' },
    ],
    toppings: [
      { id: 'extra-shot', label: 'Extra shot', price: 10000 },
      { id: 'caramel-drizzle', label: 'Caramel drizzle', price: 5000 },
    ],
  },
  {
    id: 'caramel-macchiato',
    name: 'Caramel Macchiato',
    subtitle: 'Caramel · double espresso',
    category: 'Milk coffee',
    basePrice: 58000,
    image: '/images/drinks/caramel-macchiato.png',
    largeImage: '/images/drinks/caramel-macchiato.png',
    bestseller: false,
    description: 'Steamed milk stained with bold espresso shots, kissed with real Madagascar vanilla and caramel crosshatch.',
    tags: ['Buttery caramel', 'Layered espresso', 'Sweet comfort'],
    sizes: [
      { size: 'S', label: 'Regular', price: 58000, extra: 0 },
      { size: 'M', label: 'Medium', price: 61000, extra: 3000 },
      { size: 'L', label: 'Large', price: 64000, extra: 6000 },
    ],
    milkOptions: [
      { id: 'dairy', label: 'Dairy milk', extra: 0, tag: 'Included' },
      { id: 'oat', label: 'Oat milk', extra: 0, tag: 'Included' },
    ],
    toppings: [
      { id: 'extra-shot', label: 'Extra shot', price: 10000 },
      { id: 'caramel-drizzle', label: 'Caramel drizzle', price: 5000 },
    ],
  },
  {
    id: 'mocha-velvet',
    name: 'Mocha Velvet',
    subtitle: 'Dark chocolate · espresso',
    category: 'Espresso',
    basePrice: 60000,
    image: '/images/drinks/mocha-velvet.png',
    largeImage: '/images/drinks/mocha-velvet.png',
    bestseller: false,
    description: 'Single-origin 70% dark Belgian chocolate melted into fresh espresso and steamed velvety milk.',
    tags: ['Belgian dark cacao', 'Rich & comforting', 'Signature blend'],
    sizes: [
      { size: 'S', label: 'Regular', price: 60000, extra: 0 },
      { size: 'M', label: 'Medium', price: 63000, extra: 3000 },
      { size: 'L', label: 'Large', price: 66000, extra: 6000 },
    ],
    milkOptions: [
      { id: 'dairy', label: 'Dairy milk', extra: 0, tag: 'Included' },
      { id: 'oat', label: 'Oat milk', extra: 0, tag: 'Included' },
    ],
    toppings: [
      { id: 'extra-shot', label: 'Extra shot', price: 10000 },
      { id: 'caramel-drizzle', label: 'Caramel drizzle', price: 5000 },
    ],
  },
];

export const CATEGORIES = ['Tất cả đồ uống', 'Espresso', 'Milk coffee', 'Cold & iced', 'Tea'] as const;

export const INITIAL_ORDERS = [
  {
    id: '1042',
    date: '11 Oct 2026 · 14:20',
    title: 'Brown Sugar Latte + Flat White',
    status: 'PAID',
    statusLabel: 'Payment received · Pickup in 8–12 min',
    total: 119000,
    subtotal: 124000,
    discount: 5000,
    paymentMethod: 'Bank card · Visa ending in 4242',
    items: [
      {
        name: 'Brown Sugar Latte',
        details: 'Large · Oat milk',
        qty: 1,
        price: 65000,
        image: '/images/drinks/brown-sugar-latte.png',
      },
      {
        name: 'Flat White',
        details: 'Regular · Extra shot',
        qty: 1,
        price: 59000,
        image: '/images/drinks/flat-white.png',
      },
    ],
    pointsEarned: 11,
    active: true,
  },
  {
    id: '1038',
    date: '09 Oct 2026 · 09:10',
    title: 'Vanilla Cold Brew · 1 drink',
    status: 'COMPLETED',
    statusLabel: 'Collected at 09:22 · Visa •4242',
    total: 55000,
    subtotal: 55000,
    discount: 0,
    paymentMethod: 'Visa •4242',
    items: [
      {
        name: 'Vanilla Cold Brew',
        details: 'Regular · Dairy milk',
        qty: 1,
        price: 55000,
        image: '/images/drinks/vanilla-cold-brew.png',
      },
    ],
    pointsEarned: 5,
    active: false,
  },
  {
    id: '1031',
    date: '06 Oct 2026 · 16:05',
    title: 'Matcha Cloud · 1 drink',
    status: 'CANCELLED',
    statusLabel: 'Cancelled at 16:06 · Not charged',
    total: 62000,
    subtotal: 62000,
    discount: 0,
    paymentMethod: 'Cancelled',
    items: [
      {
        name: 'Matcha Cloud',
        details: 'Regular · Oat milk',
        qty: 1,
        price: 62000,
        image: '/images/drinks/matcha-cloud.png',
      },
    ],
    pointsEarned: 0,
    active: false,
  },
  {
    id: '1027',
    date: '04 Oct 2026 · 08:42',
    title: 'Caramel Macchiato · 1 drink',
    status: 'COMPLETED',
    statusLabel: 'Collected at 08:54 · MoMo',
    total: 58000,
    subtotal: 58000,
    discount: 0,
    paymentMethod: 'MoMo',
    items: [
      {
        name: 'Caramel Macchiato',
        details: 'Regular · Dairy milk',
        qty: 1,
        price: 58000,
        image: '/images/drinks/caramel-macchiato.png',
      },
    ],
    pointsEarned: 5,
    active: false,
  },
  {
    id: '1020',
    date: '01 Oct 2026 · 10:30',
    title: 'Mocha Velvet · 1 drink',
    status: 'COMPLETED',
    statusLabel: 'Collected at 10:41 · Visa •4242',
    total: 60000,
    subtotal: 60000,
    discount: 0,
    paymentMethod: 'Visa •4242',
    items: [
      {
        name: 'Mocha Velvet',
        details: 'Regular · Dairy milk',
        qty: 1,
        price: 60000,
        image: '/images/drinks/mocha-velvet.png',
      },
    ],
    pointsEarned: 6,
    active: false,
  },
];

export const USER_PROFILE = {
  name: 'Nguyen Duy',
  email: 'duy.nguyen@example.com',
  phone: '090 123 4567',
  memberSince: 'September 2026',
  points: 131,
  nextTier: 150,
  verified: true,
};

export function formatVND(amount: number): string {
  return '₫' + amount.toLocaleString('vi-VN');
}
