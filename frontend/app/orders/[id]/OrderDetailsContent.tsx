'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, MapPin, ArrowRight } from 'lucide-react';
import { formatVND, INITIAL_ORDERS } from '@/lib/data';
import { useCartStore } from '@/lib/store';

export default function OrderDetailsContent({ orderId }: { orderId: string }) {
  const [mounted, setMounted] = useState(false);
  const getOrderById = useCartStore((state) => state.getOrderById);

  useEffect(() => {
    setMounted(true);
  }, []);

  const orderFromStore = mounted ? getOrderById(orderId) : undefined;
  const order =
    orderFromStore ||
    INITIAL_ORDERS.find((o) => o.id === orderId) ||
    INITIAL_ORDERS[0];

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <Link href="/orders" className="hover:text-[#163d2c]">
            Đơn hàng
          </Link>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">#{order.id}</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Cảm ơn Duy. Đơn hàng của bạn đã được ghi nhận.
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Đã nhận thanh toán. Tách cà phê thơm ngon của bạn sắp sẵn sàng.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Code, Timeline, Location */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Pickup Code Banner */}
            <div className="bg-[#163d2c] text-white rounded-3xl overflow-hidden border border-[#234d39] shadow-sm flex flex-col sm:flex-row items-stretch">
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#d6955b] block mb-2">
                    MÃ NHẬN HÀNG
                  </span>
                  <div className="font-serif text-5xl sm:text-6xl font-bold tracking-tight text-white mb-4">
                    #{order.id}
                  </div>
                </div>
                <p className="text-xs text-[#c2d1c7]">
                  Vui lòng xuất trình mã này tại quầy khi đơn hàng sẵn sàng.
                </p>
              </div>

              <div className="relative sm:w-52 h-44 sm:h-auto shrink-0 bg-[#224b37]">
                <Image
                  src="/images/order-code-coffee.png"
                  alt="Specialty latte"
                  fill
                  className="object-cover"
                />
              </div>
            </div>

            {/* Follow Your Coffee Timeline */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Theo dõi đơn hàng
                </h3>
                <span className="bg-[#d5e3d4] text-[#163d2c] text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full">
                  ĐÃ THANH TOÁN · Đã nhận thanh toán
                </span>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-5 gap-2 pt-2">
                {/* Step 1 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full bg-[#163d2c] text-white flex items-center justify-center mb-2 shadow-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-[#546b5a]">
                    ĐANG CHỜ
                  </span>
                  <span className="text-[11px] font-semibold text-[#14241b] mt-0.5">
                    Đơn hàng đã được ghi nhận
                  </span>
                  <span className="text-[10px] text-[#708076] mt-0.5">14:20</span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full bg-[#163d2c] text-white flex items-center justify-center mb-2 shadow-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-[#546b5a]">
                    ĐÃ THANH TOÁN
                  </span>
                  <span className="text-[11px] font-semibold text-[#14241b] mt-0.5">
                    Đã nhận thanh toán
                  </span>
                  <span className="text-[10px] text-[#708076] mt-0.5">14:21</span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#b5c7bc] text-[#8aa193] flex items-center justify-center mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#b5c7bc]" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-[#88998e]">
                    ĐANG CHUẨN BỊ
                  </span>
                  <span className="text-[11px] font-medium text-[#708076] mt-0.5">
                    Đang pha chế
                  </span>
                  <span className="text-[10px] text-[#8ca094] mt-0.5">Tiếp theo</span>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#b5c7bc] text-[#8aa193] flex items-center justify-center mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#b5c7bc]" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-[#88998e]">
                    SẴN SÀNG
                  </span>
                  <span className="text-[11px] font-medium text-[#708076] mt-0.5">
                    Chờ nhận tại quầy
                  </span>
                  <span className="text-[10px] text-[#8ca094] mt-0.5">Sắp có</span>
                </div>

                {/* Step 5 */}
                <div className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#b5c7bc] text-[#8aa193] flex items-center justify-center mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#b5c7bc]" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wider uppercase text-[#88998e]">
                    HOÀN TẤT
                  </span>
                  <span className="text-[11px] font-medium text-[#708076] mt-0.5">
                    Thưởng thức cà phê
                  </span>
                  <span className="text-[10px] text-[#8ca094] mt-0.5">Sau khi nhận hàng</span>
                </div>
              </div>

              <p className="text-xs text-[#708076] pt-3 border-t border-[#f2eee7]">
                Đơn hàng đã được thanh toán nhưng chưa sẵn sàng. Chúng tôi sẽ cập nhật trạng thái khi bắt đầu pha chế và khi bạn có thể đến nhận hàng.
              </p>
            </div>

            {/* See You at the Counter Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-4">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Hẹn gặp bạn tại quầy
              </h3>

              <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-2xl p-4 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-[#d5e3d4] border border-[#bed2bd] flex items-center justify-center text-[#163d2c] shrink-0">
                  <MapPin className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#546b5a] block">
                    ĐỊA ĐIỂM NHẬN HÀNG
                  </span>
                  <h4 className="font-semibold text-xs text-[#163d2c]">
                    Brewlite · Quận 3
                  </h4>
                  <p className="text-[11px] text-[#526658]">
                    Dự kiến sẵn sàng sau 8–12 phút
                  </p>
                  <p className="text-[10px] text-[#697f70]">
                    Vui lòng nhận hàng tại quầy. Không hỗ trợ giao hàng.
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-[#708076] pt-2">
                <span>Ngày đặt hàng</span>
                <span className="font-medium text-[#14241b]">{order.date}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Order breakdown & Actions */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Your Order Summary Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Đơn hàng của bạn
                </h2>
                <span className="bg-[#ede7dc] text-[#55695c] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {order.items.length} món
                </span>
              </div>

              <div className="divide-y divide-[#f2eee7]">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#e8e2d8] shrink-0 border border-[#eee8df]">
                      <Image
                        src={item.image || '/images/brown-sugar-latte.png'}
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
                        {item.details}
                      </p>
                      <p className="text-[10px] text-[#8ca094]">
                        Số lượng {item.qty}
                      </p>
                    </div>
                    <span className="font-serif text-sm font-bold text-[#14241b]">
                      {formatVND(item.price)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#f0ebe0] space-y-2 text-xs text-[#6e8074]">
                <div className="flex justify-between">
                  <span>Tạm tính · {order.items.length} món</span>
                  <span className="font-semibold text-[#14241b]">{formatVND(order.subtotal || 124000)}</span>
                </div>
                {(order.discount || 0) > 0 && (
                  <div className="flex justify-between text-[#266345]">
                    <span>Ưu đãi thành viên</span>
                    <span className="font-semibold">-{formatVND(order.discount)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-[#f0ebe0] flex items-baseline justify-between">
                  <span className="text-xs text-[#6e8074] font-medium">Tổng tiền đã thanh toán</span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                    {formatVND(order.total)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#f0ebe0] text-xs text-[#708076]">
                {order.paymentMethod}
              </div>
            </div>

            {/* Thank You Points Card */}
            <div className="bg-[#f5e6d6] border border-[#ebd2ba] rounded-3xl p-6 sm:p-7 shadow-xs">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#9e5d26] block mb-1">
                Lời cảm ơn nhỏ
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#7a4216] mb-2">
                +{order.pointsEarned} điểm đã tích lũy
              </h3>
              <p className="text-xs text-[#875026] leading-relaxed">
                Điểm sẽ được cộng sau khi thanh toán thành công. Cảm ơn bạn đã lựa chọn Brewlite!
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Link
                href="/orders"
                className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] text-center"
              >
                <span>Xem lịch sử đơn hàng</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/"
                className="w-full bg-[#e3ede1] hover:bg-[#d6e4d3] text-[#163d2c] text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center transition-all active:scale-[0.98] text-center"
              >
                Quay lại menu
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
