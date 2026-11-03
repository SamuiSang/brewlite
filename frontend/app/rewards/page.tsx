'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Lock, Loader2 } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatVND } from '@/lib/data';

export default function RewardsPage() {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const profile = useCartStore((state) => state.profile);
  const updateProfile = useCartStore((state) => state.updateProfile);
  const orders = useCartStore((state) => state.orders);
  const authToken = useCartStore((state) => state.authToken);
  const authUser = useCartStore((state) => state.authUser);
  const fetchProfile = useCartStore((state) => state.fetchProfile);
  const fetchMyOrders = useCartStore((state) => state.fetchMyOrders);

  const [nameInput, setNameInput] = useState(authUser?.fullName || profile?.name || '');
  const [emailInput, setEmailInput] = useState(authUser?.email || profile?.email || '');
  const [phoneInput, setPhoneInput] = useState(authUser?.phone || profile?.phone || '');

  useEffect(() => {
    setMounted(true);
    if (authToken) {
      fetchProfile();
      fetchMyOrders();
    }
  }, [authToken, fetchProfile, fetchMyOrders]);

  useEffect(() => {
    const activeName = authUser?.fullName || profile?.name || '';
    const activeEmail = authUser?.email || profile?.email || '';
    const activePhone = authUser?.phone || profile?.phone || '';
    setNameInput(activeName);
    setEmailInput(activeEmail);
    setPhoneInput(activePhone);
  }, [profile, authUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;

    setIsSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fullName: nameInput,
          phone: phoneInput,
        }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        updateProfile({
          name: updatedUser.fullName,
          phone: updatedUser.phone,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error('Lỗi lưu thông tin cá nhân:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isLoggedIn = Boolean(mounted && authToken && authUser);

  if (mounted && !isLoggedIn) {
    return (
      <div className="flex-1 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-[#e8e2d7] shadow-sm text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#e4ede3] border border-[#d2ded1] flex items-center justify-center text-[#163d2c] mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#14241b] mb-2">
            Đăng nhập để xem điểm thưởng
          </h2>
          <p className="text-xs text-[#66776c] mb-6 leading-relaxed">
            Vui lòng đăng nhập tài khoản của bạn để tra cứu điểm tích lũy thành viên, cấp độ ưu đãi và lịch sử điểm thưởng.
          </p>
          <Link
            href="/signin?redirect=/rewards"
            className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Đăng nhập ngay</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="mt-4 text-xs text-[#738478] hover:text-[#163d2c] font-medium"
          >
            Quay lại thực đơn
          </Link>
        </div>
      </div>
    );
  }

  const currentPoints = authUser?.loyaltyPoints ?? profile?.points ?? 0;
  const nextTier = profile?.nextTier || (currentPoints < 150 ? 150 : currentPoints + 100);
  const pointsRemaining = Math.max(0, nextTier - currentPoints);
  const paidOrders = orders.filter((o) => o.status === 'PAID' || o.status === 'COMPLETED');

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
                  <div className="w-14 h-14 rounded-full bg-[#f2dfce] text-[#7a4216] font-serif text-2xl font-bold flex items-center justify-center shrink-0 uppercase">
                    {nameInput.trim().charAt(0) || 'B'}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#14241b]">
                      Hi, {nameInput.trim().split(' ').pop() || 'Bạn'}
                    </h3>
                    <p className="text-xs text-[#78887e]">
                      Thành viên từ {profile?.memberSince || 'Gần đây'}
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
                    required
                    className="w-full bg-[#fbf9f5] border border-[#e8e2d7] rounded-xl px-4 py-2.5 text-xs text-[#14241b] focus:outline-none focus:border-[#163d2c] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    disabled
                    className="w-full bg-[#f2eee7] border border-[#e8e2d7] rounded-xl px-4 py-2.5 text-xs text-[#8a9990] cursor-not-allowed"
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
                    placeholder="Nhập số điện thoại nhận đơn..."
                    className="w-full bg-[#fbf9f5] border border-[#e8e2d7] rounded-xl px-4 py-2.5 text-xs text-[#14241b] focus:outline-none focus:border-[#163d2c] transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : saved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Đã lưu thành công!</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Rewards & Points summary */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Rewards Card */}
            <div className="bg-[#163d2c] text-white rounded-3xl p-6 sm:p-7 border border-[#234d39] shadow-sm relative overflow-hidden">
              <div className="relative z-10">
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
                      style={{
                        width: `${Math.min(100, (currentPoints / nextTier) * 100)}%`,
                      }}
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
                {paidOrders.length === 0 ? (
                  <p className="text-xs text-[#708076] py-3 italic">
                    Chưa có giao dịch tích điểm nào.
                  </p>
                ) : (
                  paidOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="py-3 first:pt-0">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-[#14241b]">
                          {order.date.split(' · ')[0]} · {order.orderCode || `#${order.id.slice(0, 8)}`} · {order.status}
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
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-[#f2eee7] space-y-1.5 text-xs text-[#708076]">
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
