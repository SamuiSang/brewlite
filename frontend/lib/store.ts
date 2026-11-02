import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
  orderCode?: string;
  date: string;
  title: string;
  status: 'PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
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
  phone?: string;
  loyaltyPoints?: number;
}

const EMPTY_PROFILE: UserProfileState = {
  name: '',
  email: '',
  phone: '',
  memberSince: 'Thành viên mới',
  points: 0,
  nextTier: 150,
  verified: true,
};

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
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  clearAuth: () => void;
  fetchProfile: () => Promise<void>;
  fetchMyOrders: () => Promise<void>;

  // Profile actions
  updateProfile: (updated: Partial<UserProfileState>) => void;

  // Computed helpers
  getTotalItems: () => number;
  getSubtotal: () => number;
  getDiscount: () => number;
  getTotal: () => number;
  getOrderById: (id: string) => Order | undefined;
}

function getStoredCartForUser(userId?: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `brewlite_cart_${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Lỗi đọc giỏ hàng từ localStorage:', e);
  }
  return [];
}

function saveCartForUser(userId: string | undefined, items: CartItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const key = `brewlite_cart_${userId || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error('Lỗi ghi giỏ hàng vào localStorage:', e);
  }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      voucherCode: '',
      appliedVoucher: null,
      voucherError: null,
      useLoyaltyPoints: false,
      orders: [],
      profile: EMPTY_PROFILE,
      authToken: null,
      authUser: null,

      addItem: (newItem) => {
        set((state) => {
          const generatedId =
            newItem.id ||
            `${newItem.drinkId}-${newItem.size}-${newItem.milk}-${newItem.toppings.sort().join('-')}-${newItem.note || ''}`;

          const existingIndex = state.items.findIndex((it) => it.id === generatedId);
          let updated: CartItem[];
          if (existingIndex > -1) {
            updated = [...state.items];
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: updated[existingIndex].quantity + newItem.quantity,
            };
          } else {
            updated = [
              ...state.items,
              {
                ...newItem,
                id: generatedId,
              },
            ];
          }

          saveCartForUser(state.authUser?.id, updated);
          return { items: updated };
        });
      },

      updateItem: (id, updated) => {
        set((state) => {
          const newItems = state.items.map((it) => (it.id === id ? { ...it, ...updated } : it));
          saveCartForUser(state.authUser?.id, newItems);
          return { items: newItems };
        });
      },

      removeItem: (id) => {
        set((state) => {
          const newItems = state.items.filter((it) => it.id !== id);
          saveCartForUser(state.authUser?.id, newItems);
          return { items: newItems };
        });
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
          saveCartForUser(state.authUser?.id, updated);
          return { items: updated };
        });
      },

      setQuantity: (id, quantity) => {
        set((state) => {
          const validQty = Math.max(1, Math.min(9999, Math.floor(quantity)));
          const updated = state.items.map((it) =>
            it.id === id ? { ...it, quantity: validQty } : it,
          );
          saveCartForUser(state.authUser?.id, updated);
          return { items: updated };
        });
      },

      clearCart: () => {
        const { authUser } = get();
        saveCartForUser(authUser?.id, []);
        set({
          items: [],
          appliedVoucher: null,
          voucherCode: '',
          voucherError: null,
          useLoyaltyPoints: false,
        });
      },

      applyVoucher: async (code: string) => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) {
          set({ voucherError: 'Vui lòng nhập mã giảm giá.' });
          return false;
        }

        const subtotal = get().getSubtotal();

        // 1. Thử gọi API Backend POST /orders/validate-voucher
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
          // Fallback sang danh sách mã tĩnh
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
        const { authUser } = get();
        saveCartForUser(authUser?.id, []);

        set({
          items: [],
          appliedVoucher: null,
          voucherCode: '',
          voucherError: null,
          useLoyaltyPoints: false,
        });

        // Tự động đồng bộ lịch sử đơn hàng và điểm Loyalty thực tế từ Backend
        get().fetchMyOrders();
        get().fetchProfile();

        return '';
      },

      setAuth: async (token, user) => {
        // Tải giỏ hàng riêng của user hiện tại
        const userCart = getStoredCartForUser(user.id);

        set({
          authToken: token,
          authUser: user,
          items: userCart,
          orders: [], // Reset danh sách đơn để fetch mới theo user
          voucherCode: '',
          appliedVoucher: null,
          voucherError: null,
          useLoyaltyPoints: false,
          profile: {
            name: user.fullName || '',
            email: user.email || '',
            phone: user.phone || '',
            memberSince: 'Tháng 11, 2026',
            points: user.loyaltyPoints || 0,
            nextTier: (user.loyaltyPoints || 0) < 150 ? 150 : (user.loyaltyPoints || 0) + 100,
            verified: true,
          },
        });

        // Tải dữ liệu cá nhân & lịch sử đơn hàng thực tế từ backend
        try {
          await get().fetchProfile();
          await get().fetchMyOrders();
        } catch (e) {
          console.error('Lỗi tải dữ liệu sau đăng nhập:', e);
        }
      },

      clearAuth: () => {
        const currentUserId = get().authUser?.id;
        const currentItems = get().items;
        // Lưu giỏ hàng của user trước khi logout nếu có
        if (currentUserId && currentItems.length > 0) {
          saveCartForUser(currentUserId, currentItems);
        }

        // Dọn dẹp cache storage cũ nếu còn sót lại
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('brewlite-auth-storage');
            localStorage.removeItem('brewlite-cart-storage');
          } catch {}
        }

        // RESET TOÀN BỘ VỀ 0: Cart items = [], Cart badge = 0, Orders = [], Profile = EMPTY
        set({
          authToken: null,
          authUser: null,
          profile: EMPTY_PROFILE,
          orders: [],
          items: [], // Reset Cart badge về 0 tuyệt đối khi logout
          voucherCode: '',
          appliedVoucher: null,
          voucherError: null,
          useLoyaltyPoints: false,
        });
      },

      fetchProfile: async () => {
        const { authToken } = get();
        if (!authToken) return;

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const res = await fetch(`${apiUrl}/auth/me`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            const memberDate = data.createdAt
              ? new Date(data.createdAt).toLocaleDateString('vi-VN', {
                  month: 'long',
                  year: 'numeric',
                })
              : 'Gần đây';

            const pts = Number(data.loyaltyPoints || 0);
            const nextTier = pts < 150 ? 150 : pts + 100;

            set((state) => ({
              authUser: state.authUser
                ? {
                    ...state.authUser,
                    fullName: data.fullName,
                    phone: data.phone,
                    loyaltyPoints: pts,
                  }
                : null,
              profile: {
                name: data.fullName || '',
                email: data.email || '',
                phone: data.phone || '',
                memberSince: memberDate,
                points: pts,
                nextTier,
                verified: true,
              },
            }));
          } else if (res.status === 401) {
            // Token hết hạn hoặc không hợp lệ -> Đăng xuất
            get().clearAuth();
          }
        } catch (e) {
          console.error('Lỗi gọi /auth/me:', e);
        }
      },

      fetchMyOrders: async () => {
        const { authToken } = get();
        if (!authToken) {
          set({ orders: [] });
          return;
        }

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const res = await fetch(`${apiUrl}/orders/me`, {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });

          if (res.ok) {
            const backendOrders = await res.json();
            const mappedOrders: Order[] = backendOrders.map((bo: any) => {
              const formattedDate = new Date(bo.createdAt).toLocaleDateString(
                'vi-VN',
                {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                },
              );
              const formattedTime = new Date(bo.createdAt).toLocaleTimeString(
                'vi-VN',
                {
                  hour: '2-digit',
                  minute: '2-digit',
                },
              );

              const itemsList: OrderItem[] = (bo.orderItems || []).map((oi: any) => ({
                name: oi.product?.name || 'Đồ uống',
                details: `Size ${oi.size || 'M'}`,
                qty: oi.qty,
                price: Number(oi.lineTotal || 0),
                image: oi.product?.imageUrl || '/images/drinks/default.png',
              }));

              const title =
                itemsList.length === 1
                  ? `${itemsList[0].name} · 1 ly`
                  : itemsList.length > 1
                    ? `${itemsList[0].name} + ${itemsList.length - 1} món khác`
                    : 'Đơn hàng BrewLite';

              let statusLabel = 'Đang xử lý';
              if (bo.status === 'PAID') statusLabel = 'Đã thanh toán · Chờ pha chế';
              else if (bo.status === 'PREPARING') statusLabel = 'Đang pha chế';
              else if (bo.status === 'READY') statusLabel = 'Đã sẵn sàng lấy';
              else if (bo.status === 'COMPLETED') statusLabel = 'Đã hoàn thành';
              else if (bo.status === 'CANCELLED') statusLabel = 'Đã hủy đơn';

              return {
                id: bo.id,
                orderCode: bo.orderCode,
                date: `${formattedDate} · ${formattedTime}`,
                title,
                status: bo.status,
                statusLabel,
                total: Number(bo.totalAmount || 0),
                subtotal: Number(bo.subtotal || 0),
                discount: Number(bo.discountAmount || 0),
                paymentMethod: bo.payments?.[0]?.method || 'Tại quầy',
                customerName: bo.customerName,
                phoneNumber: bo.phone,
                orderNote: bo.notes || '',
                items: itemsList,
                pointsEarned: bo.pointsEarned || 0,
                active: bo.status === 'PAID' || bo.status === 'PREPARING',
              };
            });

            set({ orders: mappedOrders });
          }
        } catch (e) {
          console.error('Lỗi gọi /orders/me:', e);
        }
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
        return orders.find((o) => o.id === id || o.orderCode === id);
      },
    }),
    {
      name: 'brewlite-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        authToken: state.authToken,
        authUser: state.authUser,
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const userId = state.authUser?.id;
          state.items = getStoredCartForUser(userId);
          if (state.authToken) {
            state.fetchProfile();
            state.fetchMyOrders();
          }
        }
      },
    }
  )
);

// Tự động dọn dẹp bộ nhớ cache phiên bản cũ
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('brewlite-cart-storage');
  } catch {}
}
