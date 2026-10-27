'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Lock } from 'lucide-react';
import { formatVND, INITIAL_ORDERS } from '@/lib/data';
import { useCartStore } from '@/lib/store';

export default function OrdersPage() {
  const [filter, setFilter] = useState<
    'All' | 'In progress' | 'Completed' | 'Cancelled'
  >('All');

  const [mounted, setMounted] = useState(false);

  const ordersFromStore = useCartStore((state) => state.orders);
  const authToken = useCartStore((state) => state.authToken);
  const authUser = useCartStore((state) => state.authUser);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoggedIn = Boolean(mounted && authToken && authUser);
  const orders = mounted ? ordersFromStore : INITIAL_ORDERS;

  // Tên hiển thị tiếng Việt, giữ nguyên giá trị lọc nội bộ
  const filterLabels = {
    All: 'Tất cả đơn hàng',
    'In progress': 'Đang xử lý',
    Completed: 'Hoàn thành',
    Cancelled: 'Đã hủy',
  } as const;

  const filterTabs = Object.keys(filterLabels) as (keyof typeof filterLabels)[];

  const filteredOrders = orders.filter((order) => {
    if (filter === 'All') return true;

    if (filter === 'In progress') {
      return order.status === 'PAID' || order.status === 'PREPARING';
    }

    if (filter === 'Completed') {
      return order.status === 'COMPLETED';
    }

    if (filter === 'Cancelled') {
      return order.status === 'CANCELLED';
    }

    return true;
  });

  const activeOrder = orders.find((o) => o.active);

  if (mounted && !isLoggedIn) {
    return (
      <div className="flex-1 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-[#e8e2d7] shadow-sm text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#e4ede3] border border-[#d2ded1] flex items-center justify-center text-[#163d2c] mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#14241b] mb-2">
            Đăng nhập để xem đơn hàng
          </h2>
          <p className="text-xs text-[#66776c] mb-6 leading-relaxed">
            Vui lòng đăng nhập tài khoản của bạn để tra cứu các đơn hàng đã đặt và theo dõi tiến độ pha chế.
          </p>
          <Link
            href="/signin?redirect=/orders"
            className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Đăng nhập ngay</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="mt-4 text-xs text-[#738478] hover:text-[#163d2c] font-medium"
          >
            Khám phá thực đơn
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <span>Tài khoản</span>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">Đơn hàng</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Hương vị cà phê, lưu giữ khoảnh khắc
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Theo dõi đơn hàng hôm nay hoặc xem lại những món yêu thích.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 scrollbar-none">
  {filterTabs.map((tab) => {
    const key = tab;
    const isActive = filter === key;

    return (
      <button
        key={tab}
        type="button"
        onClick={() => setFilter(key)}
        className={`text-xs px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
          isActive
            ? 'bg-[#163d2c] text-white shadow-sm'
            : 'bg-[#ede7dc] text-[#526359] hover:bg-[#e4ddd0]'
        }`}
      >
        {filterLabels[tab]}
      </button>
    );
  })}
</div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Orders list */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-[#e8e2d7] text-sm text-[#708076]">
                Không có đơn hàng nào trong mục này.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isActiveOrder = order.active;

                if (isActiveOrder) {
                  return (
                    <div
                      key={order.id}
                      className="bg-[#163d2c] text-white rounded-3xl overflow-hidden border border-[#234d39] shadow-sm flex flex-col sm:flex-row items-stretch"
                    >
                      <div className="relative sm:w-48 h-40 sm:h-auto shrink-0 bg-[#224b37]">
                        <Image
                          src={order.items[0]?.image || '/images/brown-sugar-latte.png'}
                          alt={order.title}
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-serif text-2xl font-bold text-white">
                              #{order.id}
                            </h3>
                            <span className="bg-[#24523c] text-[#d6ede0] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                              {order.status}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#8ca094] mb-2">{order.date}</p>
                          <h4 className="font-serif text-sm sm:text-base font-bold text-white mb-1">
                            {order.title}
                          </h4>
                          <p className="text-xs text-[#c2d1c7]">{order.statusLabel}</p>
                        </div>

                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#234d39]">
                          <span className="font-serif text-lg font-bold text-[#d6955b]">
                            {formatVND(order.total)}
                          </span>
                          <Link
                            href={`/orders/${order.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-[#d6955b] transition-colors"
                          >
                            <span>Theo dõi đơn hàng</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Standard Completed/Cancelled orders
                const isCancelled = order.status === 'CANCELLED';
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl overflow-hidden border border-[#e8e2d7] shadow-xs flex flex-col sm:flex-row items-stretch hover:shadow-md transition-shadow"
                  >
                    <div className="relative sm:w-48 h-36 sm:h-auto shrink-0 bg-[#f4efe7]">
                      <Image
                        src={order.items[0]?.image || '/images/vanilla-cold-brew.png'}
                        alt={order.title}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <h3 className="font-serif text-xl font-bold text-[#14241b]">
                            #{order.id}
                          </h3>
                          <span
                            className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${
                              isCancelled
                                ? 'bg-[#fce9e5] text-[#b33e2a]'
                                : 'bg-[#ede7dc] text-[#55695c]'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>

                        <p className="text-[11px] text-[#8ca094] mb-2">{order.date}</p>
                        <h4 className="font-serif text-sm font-bold text-[#14241b] mb-1">
                          {order.title}
                        </h4>
                        <p className="text-xs text-[#708076]">{order.statusLabel}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#f2eee7]">
                        <span className="font-serif text-base font-bold text-[#14241b]">
                          {formatVND(order.total)}
                        </span>
                        <Link
                          href={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163d2c] hover:underline"
                        >
                          <span>Xem chi tiết</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <p className="text-xs text-[#78887e] pt-2">
              hiển thị {filteredOrders.length} đơn hàng · 10-2026
            </p>
          </div>

          {/* Right Column: Promotional & Counter banner */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Your Next Coffee Break Card */}
            <div className="bg-[#f5e6d6] rounded-3xl overflow-hidden border border-[#ebd2ba] shadow-xs">
              <div className="relative w-full h-44 bg-[#ebd2ba]">
                <Image
                  src="/images/next-coffee-break.png"
                  alt="Iced cold brew"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#7a4216] mb-2">
                  Một chút thư giãn cùng cà phê
                </h3>
                <p className="text-xs text-[#875026] leading-relaxed mb-5">
                  Từ hương vị thân quen đến những điều mới mẻ, tất cả đều bắt đầu từ một ly cà phê.
                </p>
                <Link
                  href="/"
                  className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] text-center"
                >
                  <span>Khám phá thực đơn</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Pickup Made Simple Card */}
            <div className="bg-white rounded-3xl p-6 border border-[#e8e2d7] shadow-xs flex flex-col gap-3">
              <h3 className="font-serif text-xl font-bold text-[#14241b]">
                Nhận đồ uống thật dễ dàng
              </h3>
              <p className="text-xs text-[#6e8074] leading-relaxed">
                Tất cả đơn hàng đều nhận tại quầy Brewlite · Quận 3. Vui lòng cung cấp mã đơn khi nhận hàng.
              </p>
              <div className="pt-3 border-t border-[#f2eee7] flex items-center justify-between text-xs">
                <span className="text-[#708076]">Đơn hàng hiện tại</span>
                <span className="font-bold text-[#163d2c]">
                  #{activeOrder?.id || '1042'}
                </span>
              </div>
              <p className="text-[11px] text-[#55695c]">
                Đã thanh toán · Chờ pha chế
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
