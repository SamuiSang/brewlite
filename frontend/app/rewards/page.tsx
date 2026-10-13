'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatVND } from '@/lib/data';

export default function RewardsPage() {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);

  const profile = useCartStore((state) => state.profile);
  const updateProfile = useCartStore((state) => state.updateProfile);
  const orders = useCartStore((state) => state.orders);

  const [nameInput, setNameInput] = useState(profile.name);
  const [emailInput, setEmailInput] = useState(profile.email);
  const [phoneInput, setPhoneInput] = useState(profile.phone);

  useEffect(() => {
    setMounted(true);
    setNameInput(profile.name);
    setEmailInput(profile.email);
    setPhoneInput(profile.phone);
  }, [profile]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: nameInput,
      email: emailInput,
      phone: phoneInput,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentPoints = mounted ? profile.points : 131;
  const nextTier = profile.nextTier || 150;
  const pointsRemaining = Math.max(0, nextTier - currentPoints);

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <span>Tài khoản</span>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">Thông tin & điểm thưởng</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Ly cà phê tiếp theo đang chờ bạn.
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Thông tin của bạn, điểm thưởng của bạn, ưu đãi cho lần tiếp theo.
          </p>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Profile & Settings */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Profile Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Thông tin của bạn
              </h2>

              {/* Avatar and name banner */}
              <div className="flex items-center justify-between pb-4 border-b border-[#f2eee7]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#f2dfce] text-[#7a4216] font-serif text-2xl font-bold flex items-center justify-center shrink-0">
                    {nameInput.charAt(0) || 'D'}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#14241b]">
                      Hi, {nameInput.split(' ').pop() || 'Duy'}
                    </h3>
                    <p className="text-xs text-[#78887e]">
                      Thành viên từ {profile.memberSince}
                    </p>
                  </div>
                </div>

                <span className="bg-[#d5e3d4] text-[#163d2c] text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full">
                  Đã xác minh
                </span>
              </div>

              {/* Edit form */}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer mt-2"
                >
                  {saved ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                      <span>Cập nhật hồ sơ thành công!</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </form>
            </div>

            {/* Account Settings Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-4">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Cài đặt tài khoản
              </h3>

              <div className="divide-y divide-[#f2eee7] text-xs">
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#6e8074]">Password</span>
                  <button
                    type="button"
                    onClick={() => alert('Password update form')}
                    className="font-bold text-[#163d2c] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Thay đổi password</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#6e8074]">Đơn hàng</span>
                  <Link
                    href="/orders"
                    className="font-bold text-[#163d2c] hover:underline flex items-center gap-1"
                  >
                    <span>Xem lịch sử đơn hàng</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="pt-3">
                  <Link
                    href="/signin"
                    className="font-bold text-[#163d2c] hover:underline flex items-center gap-1"
                  >
                    <span>Đăng xuất</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Rewards Points & Activity */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Green Rewards Card */}
            <div className="bg-[#163d2c] text-white rounded-3xl p-6 sm:p-8 border border-[#234d39] shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#d6955b] block mb-2">
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

                <p className="text-xs text-[#a3b8ab] mb-6">
  Tích lũy 1 điểm cho mỗi 10.000₫ chi tiêu.
</p>

<div className="pt-4 border-t border-[#234d39]">
  <div className="flex justify-between text-xs text-[#c2d1c7] mb-2 font-medium">
    <span>Còn {pointsRemaining} điểm để nhận ưu đãi</span>
  </div>

  {/* Progress bar */}
  <div className="w-full h-2.5 bg-[#102e21] rounded-full overflow-hidden mb-3">
    <div
      className="h-full bg-[#d6955b] rounded-full transition-all duration-500"
      style={{ width: `${Math.min(100, (currentPoints / nextTier) * 100)}%` }}
    />
  </div>

  <p className="text-[11px] text-[#a3b8ab]">
    Đạt {nextTier} điểm để được giảm 15.000₫ cho đơn hàng tiếp theo.
  </p>
</div>
              </div>
            </div>

            {/* Points Activity Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-4">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Lịch sử điểm thưởng
              </h3>

              <div className="divide-y divide-[#f2eee7]">
                {orders.slice(0, 4).map((order) => (
                  <div key={order.id} className="py-3 first:pt-0">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#14241b]">
                        {order.date.split(' · ')[0]} · #{order.id} · {order.status}
                      </span>
                      <span className="font-bold text-[#163d2c]">
                        {order.pointsEarned > 0 ? `+${order.pointsEarned}` : '0'}
                      </span>
                    </div>
                    {order.pointsEarned > 0 && (
                  <p className="text-[11px] text-[#708076] mt-0.5">
                    Đã thanh toán {formatVND(order.total)} · Mỗi 10.000₫ được cộng 1 điểm
                  </p>
                )}
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[#f2eee7] space-y-1.5 text-xs text-[#708076]">
                <div className="flex justify-between">
                  <span>Điểm ban đầu</span>
                  <span className="font-medium text-[#14241b]">120 điểm</span>
                </div>
                <div className="flex justify-between font-bold text-[#14241b]">
                  <span>Điểm hiện tại</span>
                  <span className="text-[#163d2c]">{currentPoints} điểm</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#78887e] px-2 leading-relaxed">
              Điểm chỉ được cộng cho các đơn hàng đã thanh toán thành công. Đơn hàng bị hủy hoặc thanh toán thất bại sẽ không được cộng điểm.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
