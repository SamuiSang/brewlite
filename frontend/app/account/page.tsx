'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Lock,
  Loader2,
  LogOut,
  Ticket,
  ReceiptText,
  User,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useCartStore } from '@/lib/store';

export default function AccountPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const profile = useCartStore((state) => state.profile);
  const updateProfile = useCartStore((state) => state.updateProfile);
  const authToken = useCartStore((state) => state.authToken);
  const authUser = useCartStore((state) => state.authUser);
  const fetchProfile = useCartStore((state) => state.fetchProfile);
  const clearAuth = useCartStore((state) => state.clearAuth);

  const [nameInput, setNameInput] = useState(authUser?.fullName || profile?.name || '');
  const [emailInput, setEmailInput] = useState(authUser?.email || profile?.email || '');
  const [phoneInput, setPhoneInput] = useState(authUser?.phone || profile?.phone || '');

  useEffect(() => {
    setMounted(true);
    if (authToken) {
      fetchProfile();
    }
  }, [authToken, fetchProfile]);

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

    setSaveError('');
    setSaved(false);
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
          fullName: nameInput.trim(),
          phone: phoneInput.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSaveError(
          Array.isArray(errData.message)
            ? errData.message.join(', ')
            : errData.message || 'Không thể lưu thay đổi. Vui lòng thử lại.',
        );
        return;
      }

      const updatedUser = await res.json();
      updateProfile({
        name: updatedUser.fullName,
        phone: updatedUser.phone || '',
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Lỗi lưu thông tin cá nhân:', err);
      setSaveError('Lỗi kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/signin');
  };

  if (!mounted) {
    return <div className="flex-1 py-12" />;
  }

  const isLoggedIn = Boolean(authToken && authUser);

  if (!isLoggedIn) {
    return (
      <div className="flex-1 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-[#e8e2d7] shadow-sm text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#e4ede3] border border-[#d2ded1] flex items-center justify-center text-[#163d2c] mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#14241b] mb-2">
            Đăng nhập để xem tài khoản
          </h1>
          <p className="text-xs text-[#66776c] mb-6 leading-relaxed">
            Vui lòng đăng nhập tài khoản BrewLite của bạn để quản lý thông tin cá nhân và số điện thoại nhận đơn.
          </p>
          <Link
            href="/signin?redirect=/account"
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
  const shortName = nameInput.trim().split(' ').pop() || 'Bạn';
  const roleLabel = authUser?.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên BrewLite';

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-[#163d2c] transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">Thông tin tài khoản</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Thông tin tài khoản
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Quản lý hồ sơ cá nhân và thông tin liên hệ dùng khi nhận đơn tại quầy.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Profile Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-[#163d2c]" />
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Thông tin cá nhân
                </h2>
              </div>

              {/* Avatar and member header */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#f2eee7]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#f2dfce] text-[#7a4216] font-serif text-2xl font-bold flex items-center justify-center shrink-0 uppercase">
                    {nameInput.trim().charAt(0) || 'B'}
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#14241b]">
                      Xin chào, {shortName}
                    </h3>
                    <p className="text-xs text-[#78887e]">
                      Thành viên từ {profile?.memberSince || 'Gần đây'}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 bg-[#d5e3d4] text-[#163d2c] text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full shrink-0">
                  <ShieldCheck className="w-3 h-3" />
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
                    Email đăng nhập
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

                {saveError && (
                  <div className="flex items-center gap-2 text-xs text-[#b33e2a] bg-[#fce9e5] border border-[#f5c6bd] rounded-xl px-3.5 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

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

          {/* Right Column: Account Summary & Shortcuts */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-4">
              <h2 className="font-serif text-xl font-bold text-[#14241b]">
                Tổng quan tài khoản
              </h2>

              <div className="divide-y divide-[#f2eee7] text-xs">
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-[#738478]">Email</span>
                  <span className="font-semibold text-[#14241b] text-right break-all">
                    {emailInput || '—'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-[#738478]">Loại tài khoản</span>
                  <span className="font-semibold text-[#163d2c]">{roleLabel}</span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-[#738478]">Điểm tích lũy hiện có</span>
                  <span className="font-bold text-[#163d2c]">{currentPoints} điểm</span>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <Link
                  href="/rewards"
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#f8f5ee] hover:bg-[#f0eadf] border border-[#e8e2d7] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#163d2c] text-[#d6955b] flex items-center justify-center shrink-0">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14241b]">Ưu đãi & Điểm thưởng</p>
                      <p className="text-[11px] text-[#66776c]">
                        Xem mã khuyến mãi & lịch sử cộng điểm
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#738478] group-hover:text-[#163d2c] transition-colors shrink-0" />
                </Link>

                <Link
                  href="/orders"
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#f8f5ee] hover:bg-[#f0eadf] border border-[#e8e2d7] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#e4ede3] text-[#163d2c] flex items-center justify-center shrink-0">
                      <ReceiptText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#14241b]">Đơn hàng của tôi</p>
                      <p className="text-[11px] text-[#66776c]">
                        Tra cứu lịch sử & trạng thái pha chế
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#738478] group-hover:text-[#163d2c] transition-colors shrink-0" />
                </Link>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full bg-white hover:bg-[#fce9e5] text-[#b33e2a] border border-[#f2d2cb] text-xs font-bold py-3.5 px-5 rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất tài khoản</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
