import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { INITIAL_ORDERS, USER_PROFILE } from './data';

export interface CartItem {
  id: string;
  drinkId: string;
  name: string;
  subtitle: string;
  image: string;
  size: 'S' | 'M' | 'L';
  sizeLabel: string;
  milk: string;
  milkLabel: string;
  toppings: string[];
  toppingsLabels: string[];
  note: string;
  unitPrice: number;
  quantity: number;
  optionsLabel: string;
}

export interface Voucher {
  code: string;
  discount: number;
  discountType: 'fixed' | 'percentage' | 'FIXED_AMOUNT' | 'PERCENTAGE';
  description: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
}

export const AVAILABLE_VOUCHERS: Voucher[] = [
  {
    code: 'WELCOME10',
    discount: 10,
    discountType: 'percentage',
    minOrderAmount: 40000,
    maxDiscountAmount: 20000,
    description: 'Giảm 10% (tối đa 20.000đ) cho đơn từ 40.000đ',
  },
  {
    code: 'GIAM20K',
    discount: 20000,
    discountType: 'fixed',
    minOrderAmount: 60000,
    maxDiscountAmount: 20000,
    description: 'Giảm 20.000đ trực tiếp cho đơn từ 60.000đ',
  },
  {
    code: 'BREWLITE',
    discount: 15,
    discountType: 'percentage',
    minOrderAmount: 100000,
    maxDiscountAmount: 50000,
    description: 'Giảm 15% (tối đa 50.000đ) cho đơn từ 100.000đ',
  },
  {
    code: 'BREW5',
    discount: 5000,
    discountType: 'fixed',
    minOrderAmount: 0,
    maxDiscountAmount: 5000,
    description: 'Ưu đãi thành viên giảm 5.000đ trực tiếp',
  },
];

export interface OrderItem {
  name: string;
  details: string;
  qty: number;
  price: number;
  image: string;
}

export interface Order {
  id: string;
  date: string;
  title: string;
  status: 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  statusLabel: string;
  total: number;
  subtotal: number;
  discount: number;
  paymentMethod: string;
  customerName: string;
  phoneNumber: string;
  orderNote?: string;
  items: OrderItem[];
  pointsEarned: number;
  active: boolean;
}

export interface UserProfileState {
  name: string;
  email: string;
  phone: string;
  memberSince: string;
  points: number;
  nextTier: number;
  verified: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface CartStore {
  items: CartItem[];
  voucherCode: string;
  appliedVoucher: Voucher | null;
  voucherError: string | null;
  useLoyaltyPoints: boolean;
  orders: Order[];
  profile: UserProfileState;

  // Auth state
  authToken: string | null;
  authUser: AuthUser | null;

  // Actions
  addItem: (item: Omit<CartItem, 'id'> & { id?: string }) => void;
  updateItem: (id: string, updated: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  applyVoucher: (code: string) => Promise<boolean>;
  removeVoucher: () => void;
  setUseLoyaltyPoints: (use: boolean) => void;

  // Checkout & Orders
  createOrder: (paymentInfo: {
    customerName: string;
    phoneNumber: string;
    orderNote?: string;
    paymentMethod: string;
  }) => string;

  // Auth actions
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;

  // Profile actions
  updateProfile: (updated: Partial<UserProfileState>) => void;

  // Computed helpers
  getTotalItems: () => number;
  getSubtotal: () => number;
  getDiscount: () => number;
  getTotal: () => number;
  getOrderById: (id: string) => Order | undefined;
}

// Initial mock cart items matching the screenshots
const INITIAL_CART_ITEMS: CartItem[] = [
  {
    id: 'cart-1',
    drinkId: 'brown-sugar-latte',
    name: 'Brown Sugar Latte',
    subtitle: 'Espresso · oat milk option',
    image: '/images/brown-sugar-latte.png',
    size: 'L',
    sizeLabel: 'Large',
    milk: 'oat',
    milkLabel: 'Oat milk',
    toppings: [],
    toppingsLabels: [],
    note: 'Less sweet, please.',
    unitPrice: 65000,
    quantity: 1,
    optionsLabel: 'Large · Oat milk',
  },
  {
    id: 'cart-2',
    drinkId: 'flat-white',
    name: 'Flat White',
    subtitle: 'Double shot · silky milk',
    image: '/images/flat-white.png',
    size: 'S',
    sizeLabel: 'Regular',
    milk: 'dairy',
    milkLabel: 'Dairy milk',
    toppings: ['extra-shot'],
    toppingsLabels: ['Extra shot'],
    note: '',
    unitPrice: 59000,
    quantity: 1,
    optionsLabel: 'Regular · Extra shot',
  },
];

const DEFAULT_VOUCHER: Voucher = {
  code: 'BREW5',
  discount: 5000,
  discountType: 'fixed',
  minOrderAmount: 0,
  maxDiscountAmount: 5000,
  description: 'Ưu đãi thành viên giảm 5.000đ trực tiếp',
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: INITIAL_CART_ITEMS,
      voucherCode: 'BREW5',
      appliedVoucher: DEFAULT_VOUCHER,
      voucherError: null,
      useLoyaltyPoints: false,
      orders: INITIAL_ORDERS as Order[],
      profile: USER_PROFILE,
      authToken: null,
      authUser: null,

      addItem: (newItem) => {
        set((state) => {
          const generatedId =
            newItem.id ||
            `${newItem.drinkId}-${newItem.size}-${newItem.milk}-${newItem.toppings.sort().join('-')}-${newItem.note || ''}`;

          const existingIndex = state.items.findIndex((it) => it.id === generatedId);
          if (existingIndex > -1) {
            const updated = [...state.items];
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: updated[existingIndex].quantity + newItem.quantity,
            };
            return { items: updated };
          }

          return {
            items: [
              ...state.items,
              {
                ...newItem,
                id: generatedId,
              },
            ],
          };
        });
      },

      updateItem: (id, updated) => {
        set((state) => ({
          items: state.items.map((it) => (it.id === id ? { ...it, ...updated } : it)),
        }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        }));
      },

      updateQuantity: (id, delta) => {
        set((state) => {
          const updated = state.items
            .map((it) => {
              if (it.id === id) {
                const newQty = it.quantity + delta;
                return newQty > 0 ? { ...it, quantity: newQty } : null;
              }
              return it;
            })
            .filter((it): it is CartItem => it !== null);
          return { items: updated };
        });
      },

      setQuantity: (id, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((it) => it.id !== id) };
          }
          return {
            items: state.items.map((it) => (it.id === id ? { ...it, quantity } : it)),
          };
        });
      },

      clearCart: () => {
        set({ items: [], appliedVoucher: null, voucherCode: '', voucherError: null, useLoyaltyPoints: false });
      },

      applyVoucher: async (code: string) => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) {
          set({ voucherError: 'Vui lòng nhập mã giảm giá.' });
          return false;
        }

        const subtotal = get().getSubtotal();

        // 1. Thử gọi API Backend POST /orders/validate-voucher nếu server backend đang mở
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);

          const res = await fetch(`${apiUrl}/orders/validate-voucher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: trimmed, subtotal }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const isPercent =
              data.discountType === 'PERCENTAGE' || data.discountType === 'percentage';
            const desc = isPercent
              ? `Giảm ${data.discountValue}% (tối đa ${Number(data.maxDiscountAmount || 0).toLocaleString('vi-VN')}đ)`
              : `Giảm ${Number(data.discountValue).toLocaleString('vi-VN')}đ trực tiếp`;

            set({
              voucherCode: data.code,
              appliedVoucher: {
                code: data.code,
                discount: Number(data.discountValue),
                discountType: isPercent ? 'percentage' : 'fixed',
                minOrderAmount: data.minOrderAmount ? Number(data.minOrderAmount) : 0,
                maxDiscountAmount: data.maxDiscountAmount ? Number(data.maxDiscountAmount) : undefined,
                description: desc,
              },
              voucherError: null,
            });
            return true;
          } else {
            const errData = await res.json().catch(() => null);
            const errMsg = errData?.message || `Mã khuyến mãi "${trimmed}" không hợp lệ.`;
            set({ voucherError: errMsg });
            return false;
          }
        } catch {
          // 2. Fallback sang kiểm tra cục bộ (Local validation) khi backend offline hoặc lỗi mạng
          const found = AVAILABLE_VOUCHERS.find((v) => v.code.toUpperCase() === trimmed);
          if (!found) {
            set({ voucherError: `Mã khuyến mãi "${trimmed}" không hợp lệ hoặc đã hết hạn.` });
            return false;
          }

          if (found.minOrderAmount && subtotal < found.minOrderAmount) {
            set({
              voucherError: `Đơn hàng cần tối thiểu ${found.minOrderAmount.toLocaleString('vi-VN')}đ để áp dụng mã "${found.code}".`,
            });
            return false;
          }

          set({
            voucherCode: found.code,
            appliedVoucher: found,
            voucherError: null,
          });
          return true;
        }
      },

      removeVoucher: () => {
        set({ appliedVoucher: null, voucherCode: '', voucherError: null });
      },

      setUseLoyaltyPoints: (use: boolean) => {
        set({ useLoyaltyPoints: use });
      },

      createOrder: ({ customerName, phoneNumber, orderNote, paymentMethod }) => {
        const { items, getSubtotal, getDiscount, getTotal, orders, profile } = get();
        const subtotal = getSubtotal();
        const discount = getDiscount();
        const total = getTotal();
        const pointsEarned = Math.floor(total / 10000);

        // Generate next order ID
        const existingIds = orders.map((o) => parseInt(o.id)).filter((n) => !isNaN(n));
        const nextId = existingIds.length > 0 ? (Math.max(...existingIds) + 1).toString() : '1043';

        const orderTitle =
          items.length === 1
            ? `${items[0].name} · 1 drink`
            : `${items[0]?.name || 'Coffee'} + ${items[1]?.name || 'Drink'}`;

        const newOrder: Order = {
          id: nextId,
          date: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
          title: orderTitle,
          status: 'PAID',
          statusLabel: 'Payment received · Pickup in 8–12 min',
          total,
          subtotal,
          discount,
          paymentMethod,
          customerName,
          phoneNumber,
          orderNote,
          items: items.map((it) => ({
            name: it.name,
            details: it.optionsLabel,
            qty: it.quantity,
            price: it.unitPrice * it.quantity,
            image: it.image,
          })),
          pointsEarned,
          active: true,
        };

        // Mark previous active orders as false
        const updatedOrders = [
          newOrder,
          ...orders.map((o) => ({ ...o, active: false })),
        ];

        set({
          orders: updatedOrders,
          profile: {
            ...profile,
            points: profile.points + pointsEarned,
          },
          items: [],
          appliedVoucher: null,
          voucherCode: '',
          useLoyaltyPoints: false,
        });

        return nextId;
      },

      setAuth: (token, user) => {
        set({ authToken: token, authUser: user });
      },

      clearAuth: () => {
        set({ authToken: null, authUser: null });
      },

      updateProfile: (updated) => {
        set((state) => ({
          profile: { ...state.profile, ...updated },
        }));
      },

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      },

      getDiscount: () => {
        const { appliedVoucher, getSubtotal } = get();
        if (!appliedVoucher) return 0;
        const subtotal = getSubtotal();

        // Kiểm tra điều kiện đơn hàng tối thiểu
        if (appliedVoucher.minOrderAmount && subtotal < appliedVoucher.minOrderAmount) {
          return 0;
        }

        const isPercentage =
          appliedVoucher.discountType === 'percentage' ||
          appliedVoucher.discountType === 'PERCENTAGE';

        if (isPercentage) {
          const rawDiscount = Math.round((subtotal * appliedVoucher.discount) / 100);
          const maxDiscount = appliedVoucher.maxDiscountAmount || rawDiscount;
          return Math.min(rawDiscount, maxDiscount, subtotal);
        } else {
          return Math.min(appliedVoucher.discount, subtotal);
        }
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const discount = get().getDiscount();
        return Math.max(0, subtotal - discount);
      },

      getOrderById: (id: string) => {
        const { orders } = get();
        return orders.find((o) => o.id === id);
      },
    }),
    {
      name: 'brewlite-cart-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        voucherCode: state.voucherCode,
        appliedVoucher: state.appliedVoucher,
        useLoyaltyPoints: state.useLoyaltyPoints,
        orders: state.orders,
        profile: state.profile,
        authToken: state.authToken,
        authUser: state.authUser,
      }),
    }
  )
);
