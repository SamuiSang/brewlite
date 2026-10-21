
"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useCartStore } from "@/lib/store";

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useCartStore();

  const registered = searchParams.get("registered");
  const justRegistered =
    registered === "1" || registered === "demo";

  const [email, setEmail] = useState("duy.nguyen@example.com");
  const [password, setPassword] = useState("Password123");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3001";

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Đăng nhập thất bại. Vui lòng thử lại."
        );
        return;
      }

      if (!data.accessToken || !data.user) {
        setError("Dữ liệu đăng nhập không hợp lệ.");
        return;
      }

      // Lưu token và thông tin người dùng vào Zustand.
      setAuth(data.accessToken, data.user);

      // Điều hướng sau khi đăng nhập thành công.
      router.push("/rewards");
    } catch {
      setError(
        "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại."
      );
    } finally {
      setIsLoading(false);
    }
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
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>

              <p className="text-xs text-[#c2d1c7] leading-relaxed mb-4">
                Cà phê ngon, nhận hàng tiện lợi, thêm chút ưu đãi.
              </p>

              <div className="pt-4 border-t border-[#234d39] space-y-2 text-xs text-[#a3b8ab]">
                <p>
                  Một tài khoản, quản lý mọi đơn hàng và điểm thưởng.
                </p>
                <p>
                  Tích lũy 1 điểm cho mỗi 10.000₫ chi tiêu.
                </p>
              </div>
            </div>
          </div>

          {/* Cột phải: Form đăng nhập */}
          <div className="lg:col-span-7 flex flex-col justify-center px-0 lg:px-6">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#14241b] tracking-tight mb-2">
              Chào mừng trở lại.
            </h1>

            <p className="text-xs sm:text-sm text-[#66776c] mb-8">
              Đăng nhập để tiếp tục và tận hưởng những ưu đãi dành riêng cho bạn.
            </p>

            {/* Thông báo đăng ký thành công */}
            {justRegistered && (
              <div className="flex items-center gap-3 bg-[#e3ede1] border border-[#b8d4b5] rounded-2xl px-4 py-3 mb-4">
                <CheckCircle2 className="w-4 h-4 text-[#2f664a] shrink-0" />
                <p className="text-xs font-semibold text-[#1e5236]">
                  Tài khoản đã được tạo thành công! Đăng nhập để tiếp tục.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="signin-email"
                  className="block text-xs font-bold text-[#163d2c] mb-1.5"
                >
                  Email
                </label>

                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="Nhập email của bạn"
                  className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3.5 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              {/* Mật khẩu */}
              <div>
                <label
                  htmlFor="signin-password"
                  className="block text-xs font-bold text-[#163d2c] mb-1.5"
                >
                  Mật khẩu
                </label>

                <div className="relative">
                  <input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu"
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 pr-11 py-3.5 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all tracking-wider"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8aa193] hover:text-[#163d2c] transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Ghi nhớ và quên mật khẩu */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={rememberMe}
                  onClick={() => setRememberMe((prev) => !prev)}
                  className="bg-[#e4ede3] border border-[#d2ded1] rounded-2xl px-4 py-2.5 flex items-center gap-2.5 cursor-pointer"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      rememberMe
                        ? "bg-[#163d2c] border-[#163d2c] text-white"
                        : "border-[#98a99e] bg-white"
                    }`}
                  >
                    {rememberMe && (
                      <Check className="w-3 h-3 stroke-[3]" />
                    )}
                  </span>

                  <span className="text-xs font-semibold text-[#163d2c]">
                    Ghi nhớ đăng nhập
                  </span>
                </button>

                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-[#163d2c] hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>

              {/* Thông báo lỗi */}
              {error && (
                <div
                  role="alert"
                  className="text-xs px-4 py-3 rounded-2xl border bg-[#fce9e5] border-[#f5c6bd] text-[#b33e2a]"
                >
                  {error}
                </div>
              )}

              {/* Nút đăng nhập */}
              <button
                type="submit"
                disabled={isLoading}
                id="signin-submit-button"
                className="w-full bg-[#163d2c] hover:bg-[#102f21] disabled:bg-[#a9b5ad] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer mt-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-[#78887e]">
                Giỏ hàng vẫn được giữ nguyên. Bạn có thể tiếp tục mua sắm sau khi đăng nhập.
              </p>

              {/* Đăng ký */}
              <div className="pt-6 border-t border-[#ede7dc]">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#163d2c] hover:underline"
                >
                  <span>
                    Chưa có tài khoản Brewlite? Đăng ký ngay
                  </span>
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

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <SignInInner />
    </Suspense>
  );
}