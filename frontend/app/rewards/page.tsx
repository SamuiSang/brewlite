'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Copy,
  Gift,
  LogIn,
  Ticket,
  Loader2,
} from 'lucide-react';
import { useCartStore, AVAILABLE_VOUCHERS } from '@/lib/store';
import { formatVND } from '@/lib/data';

interface PromotionItem {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'percentage' | 'fixed' | string;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  validUntil: string | null;
  isActive: boolean;
  description?: string;
}

const PROMO_NOTES: Record<string, string> = {
  WELCOME10: 'Dành cho đơn hàng đầu tiên của tài khoản',
  GIAM20K: 'Giảm trực tiếp vào tổng giá trị đơn hàng',
  BREWLITE: 'Ưu đãi thành viên cho đơn hàng giá trị lớn',
  FREESHIP: 'Hỗ trợ phí dịch vụ & nhận hàng nhanh tại quầy',
  BREW5: 'Ưu đãi nhẹ nhàng cho mọi đơn đồ uống trong ngày',
};

export default function RewardsPage() {
  const [mounted, setMounted] = useState(false);
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const profile = useCartStore((state) => state.profile);
  const orders = useCartStore((state) => state.orders);
  const authToken = useCartStore((state) => state.authToken);
  const authUser = useCartStore((state) => state.authUser);
  const fetchProfile = useCartStore((state) => state.fetchProfile);
  const fetchMyOrders = useCartStore((state) => state.fetchMyOrders);

  useEffect(() => {
    setMounted(true);

    const loadPromotions = async () => {
      setLoadingPromos(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/vouchers?isActive=true`);
        if (res.ok) {
          const data: PromotionItem[] = await res.json();
          const now = new Date();
          const activeValid = data.filter(
            (v) => v.isActive && (!v.validUntil || new Date(v.validUntil) > now),
          );
          setPromotions(activeValid);
          return;
        }
      } catch (err) {
        console.error('Lỗi tải danh sách khuyến mãi:', err);
      } finally {
        setLoadingPromos(false);
      }

      // Fallback nếu chưa kết nối được Backend
      setPromotions(
        AVAILABLE_VOUCHERS.map((v) => ({
          code: v.code,
          discountType: v.discountType,
          discountValue: v.discount,
          minOrderAmount: v.minOrderAmount ?? null,
          maxDiscountAmount: v.maxDiscountAmount ?? null,
          validUntil: null,
          isActive: true,
          description: v.description,
        })),
      );
    };

    loadPromotions();
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchProfile();
      fetchMyOrders();
    }
  }, [authToken, fetchProfile, fetchMyOrders]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 2000);
  };

  const isLoggedIn = Boolean(mounted && authToken && authUser);
  const currentPoints = authUser?.loyaltyPoints ?? profile?.points ?? 0;
  const nextTier = profile?.nextTier || (currentPoints < 150 ? 150 : currentPoints + 100);
  const pointsRemaining = Math.max(0, nextTier - currentPoints);

  const paidOrders = useMemo(
    () => orders.filter((o) => o.status === 'PAID' || o.status === 'COMPLETED'),
    [orders],
  );

  const formatDiscountTitle = (promo: PromotionItem) => {
    const isPercentage =
      promo.discountType === 'PERCENTAGE' || promo.discountType === 'percentage';
    if (isPercentage) {
      return promo.maxDiscountAmount
        ? `Giảm ${promo.discountValue}% · tối đa ${formatVND(promo.maxDiscountAmount)}`
        : `Giảm ${promo.discountValue}%`;
    }
    return `Giảm ${formatVND(promo.discountValue)}`;
  };

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Breadcrumb & Header */}
        <div>
          <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
            <Link href="/" className="hover:text-[#163d2c] transition-colors">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-[#163d2c] font-semibold">Ưu đãi</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Ưu đãi & Điểm thưởng thành viên
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Săn mã khuyến mãi đang mở và theo dõi điểm tích lũy từ các đơn hàng của bạn.
          </p>
        </div>

        {/* Section 1: Mã khuyến mãi khả dụng */}
        <section className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <Ticket className="w-5 h-5 text-[#d6955b]" />
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Mã khuyến mãi khả dụng
              </h2>
            </div>

            <Link
              href="/cart"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163d2c] hover:text-[#d6955b] transition-colors"
            >
              <span>Đến giỏ hàng áp mã</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingPromos ? (
            <div className="py-10 flex items-center justify-center gap-2 text-xs text-[#66776c]">
              <Loader2 className="w-4 h-4 animate-spin text-[#163d2c]" />
              <span>Đang tải danh sách mã khuyến mãi...</span>
            </div>
          ) : promotions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#66776c] bg-[#fbf9f5] rounded-2xl border border-[#eee7da]">
              Hiện chưa có mã khuyến mãi nào đang mở. Vui lòng quay lại sau.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promotions.map((promo) => {
                const isCopied = copiedCode === promo.code;
                const note =
                  promo.description ||
                  PROMO_NOTES[promo.code] ||
                  'Áp dụng cho đơn hàng đủ điều kiện';

                return (
                  <div
                    key={promo.code}
                    className="bg-[#fbf9f5] rounded-2xl p-5 border border-[#e8e2d7] flex flex-col justify-between gap-4 hover:border-[#c8bfa9] transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="inline-flex items-center bg-[#f2dfce] text-[#7a4216] font-mono text-xs font-bold px-2.5 py-1 rounded-lg">
                          {promo.code}
                        </span>
                        <span className="text-[11px] font-medium text-[#66776c]">
                          {promo.code === 'WELCOME10' ? 'Đơn đầu tiên' : 'Đang áp dụng'}
                        </span>
                      </div>

                      <h3 className="font-serif text-lg font-bold text-[#14241b] mb-1">
                        {formatDiscountTitle(promo)}
                      </h3>
                      <p className="text-xs text-[#5d6e63] leading-relaxed">
                        {note}
                      </p>
                      <p className="text-[11px] text-[#78887e] mt-1.5">
                        {promo.minOrderAmount
                          ? `Đơn tối thiểu ${formatVND(promo.minOrderAmount)}`
                          : 'Không giới hạn giá trị tối thiểu'}
                        {promo.validUntil
                          ? ` · HSD ${new Date(promo.validUntil).toLocaleDateString('vi-VN')}`
                          : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyCode(promo.code)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isCopied
                          ? 'bg-[#2e7d32] text-white'
                          : 'bg-[#163d2c] hover:bg-[#102f21] text-white active:scale-[0.98]'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã sao chép {promo.code}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép mã {promo.code}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2: Tích lũy & Điểm thưởng thành viên */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Gift className="w-5 h-5 text-[#163d2c]" />
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Tích lũy & Điểm thưởng
              </h2>
            </div>

            {isLoggedIn && (
              <Link
                href="/account"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#66776c] hover:text-[#163d2c] transition-colors"
              >
                <span>Quản lý thông tin tài khoản</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {!mounted ? (
            <div className="bg-white rounded-3xl p-8 border border-[#e8e2d7] shadow-xs flex items-center justify-center gap-2 text-xs text-[#66776c]">
              <Loader2 className="w-4 h-4 animate-spin text-[#163d2c]" />
              <span>Đang tải thông tin điểm thưởng...</span>
            </div>
          ) : !isLoggedIn ? (
            <div className="bg-white rounded-3xl p-8 border border-[#e8e2d7] shadow-xs text-center flex flex-col items-center gap-4">
              <p className="text-xs sm:text-sm text-[#66776c] max-w-md leading-relaxed">
                Đăng nhập tài khoản BrewLite để xem số dư điểm thưởng thực tế và lịch sử tích lũy từ các đơn hàng của bạn.
              </p>
              <Link
                href="/signin?redirect=/rewards"
                className="inline-flex items-center gap-2 bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3 px-6 rounded-xl transition-all shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập ngay</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Rewards Summary Card */}
              <div className="lg:col-span-5 bg-[#163d2c] text-white rounded-3xl p-6 sm:p-7 border border-[#234d39] shadow-sm">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#d6955b] block mb-3">
                  BREWLITE ĐIỂM THƯỞNG
                </span>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-serif text-5xl sm:text-6xl font-bold tracking-tight text-white">
                    {currentPoints}
                  </span>
                  <span className="font-serif text-xl sm:text-2xl text-[#d6955b]">
                    điểm
                  </span>
                </div>

                <p className="text-xs text-[#a3b8ab] mb-5 leading-relaxed">
                  Tích lũy 1 điểm cho mỗi 10.000₫ chi tiêu · Quy đổi 1 điểm = 1.000₫ trực tiếp tại giỏ hàng (hiện có thể giảm{' '}
                  <strong className="text-white">{formatVND(currentPoints * 1000)}</strong>).
                </p>

                <div className="pt-4 border-t border-[#234d39]">
                  <div className="flex justify-between text-xs text-[#c2d1c7] mb-2 font-medium">
                    <span>Còn {pointsRemaining} điểm tới mốc {nextTier} điểm</span>
                    <span>{Math.min(100, Math.round((currentPoints / nextTier) * 100))}%</span>
                  </div>

                  <div className="w-full h-2.5 bg-[#102e21] rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-[#d6955b] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (currentPoints / nextTier) * 100)}%`,
                      }}
                    />
                  </div>

                  <p className="text-[11px] text-[#a3b8ab]">
                    Mỗi 10 điểm đổi ngay 10.000₫ khi đặt món. Đạt mốc {nextTier} điểm tương đương{' '}
                    {formatVND(nextTier * 1000)} ưu đãi.
                  </p>
                </div>

                {currentPoints > 0 && (
                  <Link
                    href="/cart"
                    className="mt-5 w-full bg-[#d6955b] hover:bg-[#c4844a] text-[#163d2c] text-xs font-bold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Dùng điểm tại giỏ hàng</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* Points History Card */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                    Lịch sử điểm thưởng
                  </h3>
                  <Link
                    href="/orders"
                    className="text-xs font-semibold text-[#163d2c] hover:underline"
                  >
                    Xem tất cả đơn hàng
                  </Link>
                </div>

                <div className="divide-y divide-[#f2eee7]">
                  {paidOrders.length === 0 ? (
                    <p className="text-xs text-[#708076] py-4 italic">
                      Chưa có giao dịch tích điểm nào. Hãy đặt món và thanh toán để nhận điểm thưởng!
                    </p>
                  ) : (
                    paidOrders.slice(0, 8).map((order) => (
                      <div key={order.id} className="py-3 first:pt-0">
                        <div className="flex justify-between items-center gap-2 text-xs">
                          <span className="font-semibold text-[#14241b]">
                            {order.date.split(' · ')[0]} · {order.orderCode || `#${order.id.slice(0, 8)}`} · {order.status}
                          </span>
                          <span className="font-bold text-[#163d2c] shrink-0">
                            {order.pointsEarned > 0 ? `+${order.pointsEarned} điểm` : '0 điểm'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#708076] mt-0.5">
                          Đã thanh toán {formatVND(order.total)} · Mỗi 10.000₫ được cộng 1 điểm
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-3 border-t border-[#f2eee7] space-y-2 text-xs text-[#708076]">
                  <div className="flex justify-between font-bold text-[#14241b]">
                    <span>Số dư điểm hiện tại</span>
                    <span className="text-[#163d2c]">{currentPoints} điểm</span>
                  </div>
                  <p className="text-[11px] text-[#78887e] leading-relaxed">
                    Điểm chỉ được cộng cho các đơn hàng đã thanh toán thành công. Đơn hàng bị hủy hoặc thanh toán thất bại sẽ không được cộng điểm.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
