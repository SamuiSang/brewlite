'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Minus, Plus, MapPin, ArrowRight, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatVND } from '@/lib/data';

export default function CartPage() {
  const router = useRouter();
  const [inputCode, setInputCode] = useState('');

  const {
    items,
    appliedVoucher,
    voucherError,
    updateQuantity,
    removeItem,
    applyVoucher,
    removeVoucher,
    getTotalItems,
    getSubtotal,
    getDiscount,
    getTotal,
    authToken,
    authUser,
  } = useCartStore();

  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => { setHasHydrated(true); }, []);

  const isLoggedIn = Boolean(hasHydrated && authToken && authUser);
  const totalItems = hasHydrated ? getTotalItems() : 0;
  const subtotal = hasHydrated ? getSubtotal() : 0;
  const discount = hasHydrated ? getDiscount() : 0;
  const total = hasHydrated ? getTotal() : 0;

  const handleCheckout = () => {
    if (!authToken || !authUser) {
      router.push('/signin?redirect=/checkout');
      return;
    }
    router.push('/checkout');
  };

  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      if (applyVoucher(inputCode)) {
        setInputCode('');
      }
    }
  };

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-[#163d2c]">
            Menu
          </Link>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">Giỏ hàng</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Cà phê ngon sắp sẵn sàng!
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Kiểm tra đồ uống trước khi chúng tôi pha chế.
          </p>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Cart items & Info cards */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Cart Items Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Giỏ hàng
                </h2>
                <span className="bg-[#ede7dc] text-[#55695c] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {totalItems} món
                </span>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[#66776c] mb-4">
                    Giỏ hàng của bạn đang trống. Thêm chút cà phê ngon nhé!
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 bg-[#163d2c] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-[#102f21] transition-all"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Khám phá menu</span>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#f2eee7]">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="py-5 first:pt-0 last:pb-0 flex items-start gap-4"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-[#e8e2d8] shrink-0 border border-[#eee8df]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/customize/${item.drinkId}`}>
                            <h3 className="font-serif text-base sm:text-lg font-bold text-[#14241b] hover:text-[#163d2c] transition-colors truncate">
                              {item.name}
                            </h3>
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-xs text-[#8a9990] hover:text-red-700 font-medium transition-colors cursor-pointer shrink-0"
                          >
                            xóa
                          </button>
                        </div>

                        <p className="text-xs text-[#708076] mt-0.5 mb-3">
                          {item.optionsLabel}
                          {item.note && ` · "${item.note}"`}
                        </p>

                        <div className="flex items-center justify-between">
                          {/* Quantity stepper */}
                          <div className="flex items-center bg-[#f4efe7] rounded-xl p-0.5 border border-[#e8dfd2]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#163d2c] hover:bg-[#e7dfd2] active:scale-95 transition-all cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center text-xs font-bold text-[#14241b]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#163d2c] hover:bg-[#e7dfd2] active:scale-95 transition-all cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="font-serif text-base font-bold text-[#14241b]">
                              {formatVND(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom return link */}
              <div className="pt-6 mt-6 border-t border-[#f2eee7]">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#163d2c] hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Tiếp tục khám phá menu</span>
                </Link>
              </div>
            </div>

            {/* Counter Pickup Card */}
            <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-3xl p-5 sm:p-6 shadow-xs">
              <h3 className="font-serif text-lg font-bold text-[#163d2c] mb-3">
                Nhận hàng tại quầy
              </h3>
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#d5e3d4] border border-[#bed2bd] flex items-center justify-center text-[#163d2c] shrink-0">
                  <MapPin className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#546b5a] block">
                    ĐỊA ĐIỂM NHẬN HÀNG
                  </span>
                  <h4 className="font-semibold text-sm text-[#163d2c]">
                    Brewlite · Quận 3
                  </h4>
                  <p className="text-xs text-[#526658]">
                    Dự kiến sẵn sàng sau 8–12 phút.
                  </p>
                  <p className="text-[11px] text-[#697f70]">
                    Vui lòng nhận hàng tại quầy. Không hỗ trợ giao hàng.
                  </p>
                </div>
              </div>
            </div>

            {/* Made Fresh Banner */}
            <div className="bg-[#163d2c] text-white rounded-3xl overflow-hidden p-5 sm:p-6 flex items-center gap-5 border border-[#234d39]">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-[#234d39]">
                <Image
                  src="/images/fresh-banner.png"
                  alt="Brewlite coffee cup"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h4 className="font-serif text-lg font-bold text-white mb-1.5">
                  Pha mới mỗi ngày, chẳng cần vội vàng.
                </h4>
                <p className="text-xs text-[#c2d1c7] leading-relaxed">
                  Chúng tôi sẽ bắt đầu pha chế khi thanh toán được xác nhận. Không giao hàng, chỉ có cà phê ngon chờ bạn tại quầy.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Tóm tắt đơn hàng
              </h2>

              {/* Voucher Code Input */}
              <div>
                <label className="block text-xs font-bold text-[#163d2c] mb-2">
                  Mã khuyến mãi
                </label>
                <form onSubmit={handleApplyVoucher} className="relative">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="Nhập mã khuyến mãi (VD: BREWLITE10)"
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl pl-4 pr-24 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all uppercase placeholder:normal-case placeholder:font-normal"
                  />
                  {appliedVoucher ? (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-[#d5e3d4] text-[#163d2c] text-[10px] font-bold px-2.5 py-1 rounded-xl">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Đã áp dụng</span>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#163d2c] text-white text-[10px] font-bold px-3 py-1.5 rounded-xl hover:bg-[#102f21] transition-all cursor-pointer"
                    >
                      Áp dụng
                    </button>
                  )}
                </form>

                {appliedVoucher && (
                  <p className="text-[11px] text-[#55695c] mt-2 flex items-center justify-between">
                    <span>{appliedVoucher.description}</span>
                    <button
                      type="button"
                      onClick={removeVoucher}
                      className="text-red-700 underline text-[10px] ml-2 cursor-pointer"
                    >
                      Xóa
                    </button>
                  </p>
                )}

                {voucherError && (
                  <p className="text-[11px] text-red-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{voucherError}</span>
                  </p>
                )}
              </div>

              {/* Price Calculations */}
              <div className="pt-4 border-t border-[#f0ebe0] space-y-2.5 text-xs text-[#6e8074]">
                <div className="flex justify-between">
                  <span>Tạm tính · {totalItems} món</span>
                  <span className="font-semibold text-[#14241b]">{formatVND(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-[#266345]">
                    <span>Khuyến mãi</span>
                    <span className="font-semibold">-{formatVND(discount)}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-[#f0ebe0] flex items-baseline justify-between">
                  <span className="text-xs text-[#6e8074] font-medium">Tổng cộng</span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                    {formatVND(total)}
                  </span>
                </div>
              </div>

              {/* Banner nhắc đăng nhập nếu chưa đăng nhập */}
              {!isLoggedIn && items.length > 0 && (
                <div className="bg-[#fff9f0] border border-[#f3d9b1] rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-[#8c5e2d]">
                  <AlertCircle className="w-4 h-4 text-[#d6955b] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-[#6e461f]">Bạn chưa đăng nhập</p>
                    <p className="text-[11px] text-[#8c5e2d] mt-0.5 leading-relaxed">
                      Vui lòng đăng nhập tài khoản để tiếp tục thanh toán đơn hàng và tích lũy điểm thưởng.
                    </p>
                    <Link
                      href="/signin?redirect=/checkout"
                      className="inline-block mt-1.5 font-bold text-[#163d2c] hover:underline"
                    >
                      Đăng nhập ngay &rarr;
                    </Link>
                  </div>
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="button"
                disabled={items.length === 0}
                onClick={handleCheckout}
                className="w-full bg-[#163d2c] hover:bg-[#102f21] disabled:bg-[#a9b5ad] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
              >
                <span>{isLoggedIn ? 'Tiếp tục thanh toán' : 'Đăng nhập để thanh toán'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-[#78887e] text-center">
                Thanh toán an toàn bằng ví điện tử hoặc thẻ ngân hàng.
              </p>
            </div>

            <p className="text-[11px] text-[#78887e] px-2 leading-relaxed">
              Tích lũy 1 điểm cho mỗi 10.000đ chi tiêu. Điểm được cộng sau khi thanh toán thành công.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
