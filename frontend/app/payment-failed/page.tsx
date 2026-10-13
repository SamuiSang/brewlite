'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, MapPin, ArrowRight } from 'lucide-react';
import { formatVND } from '@/lib/data';
import { useCartStore } from '@/lib/store';

export default function PaymentFailedPage() {
  const { items, getTotalItems, getSubtotal, getDiscount, getTotal } = useCartStore();

  const totalItems = getTotalItems() || 2;
  const subtotal = getSubtotal() || 124000;
  const discount = getDiscount() || 5000;
  const total = getTotal() || 119000;

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <Link href="/checkout" className="hover:text-[#163d2c]">
            Thanh toán
          </Link>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">Trạng thái thanh toán</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Đơn hàng của bạn chưa được thanh toán.
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Thanh toán chưa thành công. Giỏ hàng của bạn vẫn được giữ nguyên.
          </p>
        </div>
        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Failure Card & Secondary Payment */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Failed Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fbe7e2] text-[#d6513b] flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="bg-[#fce9e5] text-[#b33e2a] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                  THANH TOÁN THẤT BẠI
                </span>
              </div>

              <div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b] mb-2">
                  Hãy thử thanh toán lại nhé!
                </h2>
                <p className="text-xs sm:text-sm text-[#66776c] leading-relaxed">
                  Ngân hàng từ chối giao dịch. Hãy kiểm tra thông tin thẻ hoặc chọn ví điện tử khác. Đồ uống của bạn chưa được pha chế.
                </p>
              </div>

              <div className="py-4 border-y border-[#f2eee7] space-y-2 text-xs text-[#6e8074]">
                <div className="flex justify-between">
                  <span>Mã đơn hàng</span>
                  <span className="font-semibold text-[#14241b]">#1042</span>
                </div>
                <div className="flex justify-between">
                  <span>Giao dịch thanh toán</span>
                  <span className="font-semibold text-[#14241b]">{formatVND(total)} · Visa •4242</span>
                </div>
                <div className="flex justify-between">
                  <span>Thời gian</span>
                  <span className="font-medium text-[#14241b]">11 Oct 2026 · 14:21</span>
                </div>
              </div>

              <p className="text-xs text-red-600 font-medium">
                Thanh toán chưa được xác nhận. Bạn chưa nhận được điểm thành viên.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/checkout"
                  className="flex-1 bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] text-center"
                >
                  <span>Thử thanh toán lại</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/cart"
                  className="bg-[#e4ede3] hover:bg-[#d5e3d4] text-[#163d2c] text-xs font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98] text-center"
                >
                  Quay lại giỏ hàng
                </Link>
              </div>
            </div>

            {/* Need Another Way Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-3">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Bạn muốn chọn phương thức thanh toán khác?
              </h3>
              <p className="text-xs sm:text-sm text-[#66776c] leading-relaxed">
                Bạn có thể chọn MoMo, ZaloPay hoặc thẻ ngân hàng khác tại trang thanh toán. Hai món đồ uống và ưu đãi thành viên vẫn được giữ nguyên.
              </p>
              <div className="pt-2">
                <Link
                  href="/checkout"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163d2c] hover:underline"
                >
                  <span>Đổi phương thức thanh toán</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Pickup */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Your Order Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Đơn hàng của bạn
                </h2>
                <span className="bg-[#ede7dc] text-[#55695c] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {totalItems} món
                </span>
              </div>

              <div className="divide-y divide-[#f2eee7]">
                {(items.length > 0
                  ? items
                  : [
                      {
                        id: 'demo-1',
                        name: 'Brown Sugar Latte',
                        optionsLabel: 'Large · Oat milk',
                        quantity: 1,
                        unitPrice: 65000,
                        image: '/images/brown-sugar-latte.png',
                      },
                      {
                        id: 'demo-2',
                        name: 'Flat White',
                        optionsLabel: 'Regular · Extra shot',
                        quantity: 1,
                        unitPrice: 59000,
                        image: '/images/flat-white.png',
                      },
                    ]
                ).map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#e8e2d8] shrink-0 border border-[#eee8df]">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif text-sm font-bold text-[#14241b] truncate">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-[#708076]">
                        {item.optionsLabel}
                      </p>
                      <p className="text-[10px] text-[#8ca094]">
                        Số lượng {item.quantity}
                      </p>
                    </div>
                    <span className="font-serif text-sm font-bold text-[#14241b]">
                      {formatVND(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#f0ebe0] space-y-2 text-xs text-[#6e8074]">
                <div className="flex justify-between">
                  <span>Tạm tính · {totalItems} món </span>
                  <span className="font-semibold text-[#14241b]">{formatVND(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#266345]">
                    <span>Ưu đãi thành viên</span>
                    <span className="font-semibold">-{formatVND(discount)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-[#f0ebe0] flex items-baseline justify-between">
                  <span className="text-xs text-[#6e8074] font-medium">Tổng thanh toán</span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                    {formatVND(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pickup Location Card */}
            <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-3xl p-5 sm:p-6 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-[#d5e3d4] border border-[#bed2bd] flex items-center justify-center text-[#163d2c] shrink-0">
                  <MapPin className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#546b5a] block">
                    ĐỊA ĐIỂM NHẬN HÀNG
                  </span>
                  <h4 className="font-semibold text-xs text-[#163d2c]">
                    Brewlite · District 3
                  </h4>
                  <p className="text-[11px] text-[#526658]">
                    Dự kiến sẵn sàng sau 8–12 phút
                  </p>
                  <p className="text-[10px] text-[#697f70]">
                    Vui lòng nhận hàng tại quầy. Không hỗ trợ giao hàng.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#78887e] px-2 leading-relaxed">
              Thời gian chuẩn bị đơn hàng bắt đầu sau khi thanh toán thành công.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
