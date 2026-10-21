"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Check } from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('Nguyen Duy');
  const [email, setEmail] = useState('duy.nguyen@example.com');
  const [password, setPassword] = useState('Password123');
  const [confirmPassword, setConfirmPassword] = useState('Password123');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Mật khẩu phải bao gồm cả chữ cái và chữ số.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (!agreed) {
      setError('Vui lòng đồng ý với điều khoản và chính sách bảo mật.');
      return;
    }

    router.push('/rewards');
  };

  return (
    <div className="flex-1 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

          {/* Cột trái: Giới thiệu thương hiệu */}
          <div className="lg:col-span-5 bg-[#163d2c] text-white rounded-3xl overflow-hidden border border-[#234d39] shadow-sm p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#d6955b] block mb-2">
                KHOẢNH KHẮC THƯ GIÃN MỖI NGÀY
              </span>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-6 leading-tight">
                Một ly cà phê ngon.
              </h2>

              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-6 border border-[#224b37]">
                <Image
                  src="/images/coffee-cup-auth.png"
                  alt="Ly cà phê Brewlite"
                  fill
                  className="object-cover"
                />
              </div>

              <p className="text-xs text-[#c2d1c7] leading-relaxed mb-4">
                Cà phê ngon, nhận hàng tiện lợi, thêm chút ưu đãi.
              </p>

              <div className="pt-4 border-t border-[#234d39] space-y-2 text-xs text-[#a3b8ab]">
                <p>Một tài khoản, quản lý mọi đơn hàng và điểm thưởng.</p>
                <p>Tích lũy 1 điểm cho mỗi 10.000₫ chi tiêu.</p>
              </div>
            </div>
          </div>

          {/* Cột phải: Form đăng ký */}
          <div className="lg:col-span-7 flex flex-col justify-center px-0 lg:px-6">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#14241b] tracking-tight mb-2">
              Tạo tài khoản
            </h1>

            <p className="text-xs sm:text-sm text-[#66776c] mb-6">
              Đăng ký để đặt cà phê và theo dõi đơn hàng dễ dàng hơn.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                  Họ và tên
                </label>

                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                  Email
                </label>

                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              {/* Mật khẩu */}
              <div>
                <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                  Passwords
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 pr-11 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all tracking-wider"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8aa193] hover:text-[#163d2c] transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-[#78887e] mt-1">
                  Mật khẩu cần có ít nhất 8 ký tự, bao gồm chữ cái và chữ số.
                </p>
              </div>

              {/* Xác nhận mật khẩu */}
              <div>
                <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                  Xác nhận mật khẩu
                </label>

                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 pr-11 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all tracking-wider"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8aa193] hover:text-[#163d2c] transition-colors cursor-pointer"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Đồng ý điều khoản */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setAgreed(!agreed)}
                  aria-pressed={agreed}
                  className="w-full bg-[#e4ede3] border border-[#d2ded1] rounded-2xl px-4 py-3 flex items-center gap-2.5 cursor-pointer text-left"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      agreed
                        ? 'bg-[#163d2c] border-[#163d2c] text-white'
                        : 'border-[#98a99e] bg-white'
                    }`}
                  >
                    {agreed && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  <span className="text-xs font-semibold text-[#163d2c]">
                    Tôi đồng ý với Điều khoản và Chính sách bảo mật
                  </span>
                </button>
              </div>

              {/* Thông báo lỗi */}
              {error && (
                <p
                  role="alert"
                  className="text-xs text-red-600"
                >
                  {error}
                </p>
              )}

              {/* Nút đăng ký */}
              <button
                type="submit"
                disabled={!agreed}
                className="w-full bg-[#163d2c] hover:bg-[#102f21] disabled:bg-[#a9b5ad] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer mt-3"
              >
                <span>Tạo tài khoản</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Chuyển sang đăng nhập */}
              <div className="pt-4 border-t border-[#ede7dc]">
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163d2c] hover:underline"
                >
                  <span>Đã có tài khoản? Đăng nhập</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
