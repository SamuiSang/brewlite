'use client';
import React, { useState, useEffect, useRef } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, ShoppingBag, LogOut, User, ChevronDown } from 'lucide-react';
import { useCartStore } from '@/lib/store';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const totalItems = useCartStore((state) => state.getTotalItems());
  const authUser = useCartStore((state) => state.authUser);
  const clearAuth = useCartStore((state) => state.clearAuth);
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => { setHasHydrated(true); }, []);


  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { name: 'Thực đơn', href: '/' },
    { name: 'Câu chuyện', href: '/story' },
    { name: 'Phần thưởng', href: '/rewards' },
    { name: 'Đơn hàng', href: '/orders' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    clearAuth();
    setShowUserMenu(false);
    router.push('/signin');
  };

  // Lấy tên hiển thị ngắn gọn (tên cuối)
  const displayName = hasHydrated && authUser
    ? authUser.fullName.split(' ').pop() || authUser.fullName
    : 'Duy';

  const isLoggedIn = hasHydrated && !!authUser;

  return (
    <header className="bg-[#163d2c] text-[#f7f4ee] sticky top-0 z-50 shadow-sm border-b border-[#123324]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0 group">
          <div className="w-9 h-9 rounded-full bg-[#d6955b] flex items-center justify-center text-[#163d2c] font-serif font-bold text-xl shadow-inner group-hover:scale-105 transition-transform">
            B
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-tight text-white leading-tight">
              brew lite
            </span>
            <span className="text-[8px] uppercase tracking-widest text-[#d8c3b0] font-sans font-medium">
              CÀ PHÊ NGON, GIÁC GEN
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/' || pathname.startsWith('/customize')
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.name}
                href={link.href}
                className={`relative py-1 transition-colors hover:text-[#d6955b] ${
                  isActive ? 'text-white font-semibold' : 'text-[#c2d1c7]'
                }`}
              >
                {link.name}
                {isActive && (
                  <span className="absolute bottom-[-4px] left-0 right-0 h-[2px] bg-[#d6955b] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Search, Cart & User */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative hidden sm:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8ca094]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm đồ uống yêu thích của bạn..."
              className="bg-[#102e21] text-xs text-white placeholder-[#8ca094] pl-9 pr-3 py-1.5 rounded-full w-48 lg:w-56 border border-[#214c38] focus:outline-none focus:border-[#d6955b] transition-all"
            />
          </form>

          {/* Cart Badge Button */}
          <Link
            href="/cart"
            id="navbar-cart-button"
            className="flex items-center gap-1.5 bg-[#d6955b] hover:bg-[#c4844a] text-[#163d2c] font-semibold text-xs px-3 py-1.5 rounded-full transition-transform active:scale-95 shadow-sm"
          >
            <ShoppingBag className="w-3.5 h-3.5 stroke-[2.2]" />
            <span id="cart-badge-count">{hasHydrated ? totalItems : 0}</span>
          </Link>

          {/* User Profile / Auth */}
          {isLoggedIn ? (
            /* Đã đăng nhập: hiển thị tên + dropdown */
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                id="navbar-user-menu-button"
                className="flex items-center gap-1.5 text-xs font-medium text-[#c2d1c7] hover:text-white transition-colors cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-[#d6955b] flex items-center justify-center text-[#163d2c] font-bold text-[10px] shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span>Chào, {displayName}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-[#163d2c] border border-[#234d39] rounded-2xl shadow-xl overflow-hidden z-50">
                  <Link
                    href="/rewards"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-xs font-medium text-[#c2d1c7] hover:bg-[#1d4e38] hover:text-white transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Tài khoản & Điểm thưởng</span>
                  </Link>
                  <div className="border-t border-[#234d39]" />
                  <button
                    onClick={handleLogout}
                    id="navbar-logout-button"
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-medium text-[#e8a07a] hover:bg-[#1d4e38] hover:text-[#d6955b] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Chưa đăng nhập: hiển thị nút Đăng nhập */
            <Link
              href="/signin"
              id="navbar-signin-link"
              className="text-xs font-medium text-[#c2d1c7] hover:text-white transition-colors"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
