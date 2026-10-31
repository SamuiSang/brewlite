'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ArrowRight, Check, AlertCircle, Coffee } from 'lucide-react';
import { formatVND } from '@/lib/data';
import { useCartStore } from '@/lib/store';
import {
  fetchProductById,
  fetchToppings,
  NormalizedProduct,
  ApiTopping,
} from '@/lib/api';

interface SizeConfig {
  size: 'S' | 'M' | 'L';
  label: string;
  name: string;
  extra: number;
}

const SIZES: SizeConfig[] = [
  { size: 'S', label: 'Regular', name: 'Nhỏ', extra: 0 },
  { size: 'M', label: 'Medium', name: 'Vừa', extra: 5000 },
  { size: 'L', label: 'Large', name: 'Lớn', extra: 10000 },
];

interface MilkOption {
  id: string;
  label: string;
  extra: number;
}

const MILK_OPTIONS: MilkOption[] = [
  { id: 'dairy', label: 'Sữa tươi thanh trùng (Dairy milk)', extra: 0 },
  { id: 'oat', label: 'Sữa yến mạch nguyên chất (Oat milk)', extra: 0 },
];

export default function CustomizeContent({ drinkId }: { drinkId: string }) {
  const router = useRouter();

  // Dữ liệu sản phẩm và toppings từ API
  const [product, setProduct] = useState<NormalizedProduct | null>(null);
  const [availableToppings, setAvailableToppings] = useState<ApiTopping[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  // Zustand Store
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  // Kiểm tra xem món này đã có trong giỏ hàng chưa
  const existingCartItem = useMemo(() => {
    return cartItems.find((it) => it.drinkId === drinkId);
  }, [cartItems, drinkId]);

  // Các tùy chọn người dùng đã chọn
  const [selectedSize, setSelectedSize] = useState<'S' | 'M' | 'L'>('L');
  const [selectedMilk, setSelectedMilk] = useState<string>('oat');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [drinkNote, setDrinkNote] = useState<string>('Ít ngọt, nhiều đá');
  const [quantity, setQuantity] = useState<number>(1);

  // Nạp thông tin sản phẩm và toppings từ API (Task 4)
  const loadProductData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [prodData, toppingsData] = await Promise.all([
        fetchProductById(drinkId),
        fetchToppings(),
      ]);

      if (prodData) {
        setProduct(prodData);
      } else {
        setIsError(true);
      }

      if (toppingsData && toppingsData.length > 0) {
        setAvailableToppings(toppingsData);
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết sản phẩm:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [drinkId]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  // Đồng bộ cấu hình cũ nếu món đã có trong giỏ hàng
  useEffect(() => {
    if (existingCartItem) {
      setSelectedSize(existingCartItem.size);
      setSelectedMilk(existingCartItem.milk || 'dairy');
      setSelectedToppings(existingCartItem.toppings || []);
      setDrinkNote(existingCartItem.note || '');
      setQuantity(existingCartItem.quantity || 1);
    }
  }, [existingCartItem]);

  // TÍNH TOÁN GIÁ TIỀN THỜI GIAN THỰC (Realtime Pricing Calculation)
  const basePrice = product ? product.basePrice : 0;

  // Chốt chặn tồn kho: Kiểm tra món hết hàng khi stock <= 0
  const isOutOfStock = Boolean(product && (product.stock ?? 0) <= 0);

  // Phụ thu Size
  const sizeOption = SIZES.find((s) => s.size === selectedSize) || SIZES[0];
  const sizeExtra = sizeOption.extra;

  // Phụ thu Toppings
  const toppingsExtra = useMemo(() => {
    return selectedToppings.reduce((sum, topId) => {
      const topping = availableToppings.find((t) => t.id === topId);
      const topPrice = topping
        ? typeof topping.price === 'number'
          ? topping.price
          : parseFloat(String(topping.price)) || 0
        : 0;
      return sum + topPrice;
    }, 0);
  }, [selectedToppings, availableToppings]);

  // Đơn giá 1 ly
  const unitPrice = basePrice + sizeExtra + toppingsExtra;

  // Tổng tiền theo số lượng
  const totalPrice = unitPrice * quantity;

  // Toggle Topping
  const handleToggleTopping = (topId: string) => {
    setSelectedToppings((prev) =>
      prev.includes(topId) ? prev.filter((id) => id !== topId) : [...prev, topId]
    );
  };

  // Tăng giảm số lượng
  const handleIncreaseQty = () => setQuantity((q) => q + 1);
  const handleDecreaseQty = () => setQuantity((q) => (q > 1 ? q - 1 : 1));

  // Thêm vào giỏ hàng
  const handleAddToCart = () => {
    if (!product) return;

    // Không cho thêm vào giỏ nếu món đã hết hàng
    if (isOutOfStock) return;

    const milkOption = MILK_OPTIONS.find((m) => m.id === selectedMilk);
    const toppingsLabels = selectedToppings
      .map((tId) => availableToppings.find((t) => t.id === tId)?.name)
      .filter(Boolean) as string[];

    const optionsLabelParts = [
      `${sizeOption.size} (${sizeOption.label})`,
      milkOption?.label.split('(')[0].trim() || 'Sữa tiêu chuẩn',
    ];
    if (toppingsLabels.length > 0) {
      optionsLabelParts.push(...toppingsLabels);
    }

    addItem({
      drinkId: product.id,
      name: product.name,
      subtitle: product.subtitle,
      image: product.image,
      size: selectedSize,
      sizeLabel: sizeOption.label,
      milk: selectedMilk,
      milkLabel: milkOption?.label || 'Sữa tươi tiêu chuẩn',
      toppings: selectedToppings,
      toppingsLabels,
      note: drinkNote,
      unitPrice,
      quantity,
      optionsLabel: optionsLabelParts.join(' · '),
    });

    router.push('/cart');
  };

  // Trạng thái đang tải (Loading Skeleton)
  if (isLoading) {
    return (
      <div className="flex-1 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 animate-pulse">
          <div className="h-4 bg-[#e8e2d7] rounded w-48 mb-8" />
          <div className="h-10 bg-[#e8e2d7] rounded w-96 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 h-[480px] bg-[#e4dfd5] rounded-3xl" />
            <div className="lg:col-span-6 h-[560px] bg-[#e4dfd5] rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  // Trạng thái không tìm thấy sản phẩm (Error / Not found)
  if (isError || !product) {
    return (
      <div className="flex-1 py-16">
        <div className="max-w-md mx-auto px-4 text-center bg-white p-8 rounded-3xl border border-[#e8e2d7] shadow-xs">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#14241b] mb-2">
            Không tìm thấy đồ uống
          </h2>
          <p className="text-xs text-[#708076] mb-6">
            Món bạn tìm kiếm có thể đã đổi tên hoặc tạm ngừng phục vụ. Vui lòng quay lại thực đơn để chọn món khác.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#163d2c] hover:bg-[#1f4e39] text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <Coffee className="w-4 h-4" />
            <span>Quay lại Menu</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 sm:py-12 bg-[#fbf9f5]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb dẫn hướng */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-[#163d2c]">
            Menu
          </Link>
          <span>/</span>
          <span className="text-[#738478]">{product.category}</span>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">{product.name}</span>
        </div>

        {/* Tiêu đề trang */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Tùy chỉnh ly cà phê theo sở thích của bạn.
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Chọn kích cỡ, thêm topping yêu thích và tận hưởng trọn vẹn hương vị.
          </p>
        </div>

        {/* Layout 2 cột: Cột trái (Card sản phẩm) - Cột phải (Form tùy chọn & Bảng giá) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CỘT TRÁI: Thẻ sản phẩm nổi bật tông màu xanh thương hiệu BrewLite */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="bg-[#163d2c] text-white rounded-3xl overflow-hidden border border-[#234d39] shadow-sm">
              <div className="relative w-full aspect-[4/3] bg-[#224b37]">
                <Image
                  src={product.largeImage || product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>

              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-2 mb-3">
                  {/* Nhãn trạng thái khi hết hàng */}
                  {isOutOfStock ? (
                    <span className="text-[10px] font-bold text-rose-200 bg-rose-950/60 border border-rose-500/40 px-2.5 py-1 rounded-full shadow-xs">
                      Tạm hết hàng
                    </span>
                  ) : product.bestseller ? (
                    <span className="bg-[#f8f5ee] text-[#163d2c] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                      BÁN CHẠY
                    </span>
                  ) : null}
                  <span className="bg-[#24523c] text-[#d6ede0] text-[10px] font-medium px-2.5 py-1 rounded-full">
                    {product.category}
                  </span>
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-3">
                  {product.name}
                </h2>

                {/* Khung cảnh báo khi hết hàng hoặc thiếu nguyên liệu */}
                {isOutOfStock && (
                  <div className="bg-[#261514] border border-rose-500/50 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-200 mb-5 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-rose-300">Món này hiện đang tạm hết hàng</p>
                      <p className="text-[11px] text-rose-200/85 mt-1 leading-relaxed">
                        Quán hiện tại đã hết nguyên liệu pha chế cho món này. Quý khách vui lòng chọn món khác trong thực đơn nhé!
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-xs sm:text-sm text-[#c2d1c7] leading-relaxed mb-6">
                  {product.description}
                </p>

                <div className="font-serif text-xl sm:text-2xl font-bold text-[#d6955b] mb-4">
                  Giá khởi điểm từ {formatVND(product.basePrice)}
                </div>

                <div className="text-[11px] text-[#a3b8ab] flex flex-wrap gap-2 pt-4 border-t border-[#234d39]">
                  <span className="inline-block bg-[#1a4432] px-2.5 py-1 rounded-md">
                    ✓ Pha chế tươi mới khi nhận đơn
                  </span>
                  <span className="inline-block bg-[#1a4432] px-2.5 py-1 rounded-md">
                    ✓ Tùy chỉnh sữa yến mạch
                  </span>
                </div>
              </div>
            </div>

            {/* Thông tin quầy nhận hàng */}
            <div className="text-xs text-[#6e7d73] px-2">
              Nhận nước trực tiếp tại <strong>BrewLite · Chi nhánh Quận 3</strong>. Món nước của bạn sẽ sẵn sàng trong 8–12 phút sau khi xác nhận đơn.
            </div>
          </div>

          {/* CỘT PHẢI: Bảng tùy chỉnh (Size, Sữa, Topping, Ghi chú, Tính giá) */}
          <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e2d7] shadow-sm">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b] mb-6">
              Tùy biến món của bạn
            </h2>

            {/* 1. CHỌN SIZE (S, M, L) - Task 4 */}
            <div className="mb-6">
              <label className="text-xs font-bold text-[#163d2c] uppercase tracking-wider block mb-3">
                Kích cỡ ly (Size) {isOutOfStock && <span className="text-[11px] text-rose-600 font-normal normal-case">(Tạm khóa)</span>}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {SIZES.map((s) => {
                  const isSelected = selectedSize === s.size;
                  const itemPrice = product.basePrice + s.extra;
                  return (
                    <button
                      key={s.size}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => !isOutOfStock && setSelectedSize(s.size)}
                      className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-between ${
                        isOutOfStock
                          ? 'bg-[#f4efe7] border-[#e8e2d7] opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#163d2c] text-white border-[#163d2c] shadow-sm scale-[1.02] cursor-pointer'
                          : 'bg-[#faf8f4] hover:bg-[#f0ebe1] text-[#33443a] border-[#e8e2d7] cursor-pointer'
                      }`}
                    >
                      <span className="font-serif text-xl font-bold block mb-1">
                        {s.size}
                      </span>
                      <span className={`text-[11px] font-medium block ${isOutOfStock ? 'text-gray-400' : isSelected ? 'text-[#c2d1c7]' : 'text-[#708076]'}`}>
                        {s.label}
                      </span>
                      <span className={`text-xs font-semibold mt-2 block ${isOutOfStock ? 'text-gray-400' : isSelected ? 'text-[#d6955b]' : 'text-[#163d2c]'}`}>
                        {formatVND(itemPrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. TÙY CHỌN SỮA (Milk Preference) */}
            <div className="mb-6">
              <label className="text-xs font-bold text-[#163d2c] uppercase tracking-wider block mb-3">
                Loại sữa pha chế {isOutOfStock && <span className="text-[11px] text-rose-600 font-normal normal-case">(Tạm khóa)</span>}
              </label>
              <div className="space-y-2.5">
                {MILK_OPTIONS.map((m) => {
                  const isSelected = selectedMilk === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => !isOutOfStock && setSelectedMilk(m.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isOutOfStock
                          ? 'bg-[#f4efe7] border-[#e8e2d7] opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#e4ede3] border-[#24523c] text-[#163d2c] cursor-pointer'
                          : 'bg-[#faf8f4] border-[#e8e2d7] text-[#55695c] hover:bg-[#f3eee5] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isOutOfStock
                              ? 'border-gray-300 bg-gray-200'
                              : isSelected
                              ? 'border-[#163d2c] bg-[#163d2c]'
                              : 'border-[#94a399] bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className={`text-xs font-semibold ${isOutOfStock ? 'text-gray-400' : ''}`}>{m.label}</span>
                      </div>
                      <span className="text-[11px] text-[#708076] font-medium">Bao gồm</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. TÙY CHỌN TOPPING (Toppings - Multi Select) - Task 4 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-[#163d2c] uppercase tracking-wider block">
                  Thêm Topping ({selectedToppings.length} đã chọn)
                </label>
                <span className="text-[11px] text-[#708076]">Tùy chọn thêm</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {availableToppings.map((t) => {
                  const isSelected = selectedToppings.includes(t.id);
                  // Kiểm tra tồn kho topping
                  const isToppingOutOfStock =
                    t.isAvailable === false || (t.stock !== undefined && t.stock !== null && t.stock <= 0);
                  const isToppingDisabled = isOutOfStock || isToppingOutOfStock;
                  const priceNum = typeof t.price === 'number' ? t.price : parseFloat(String(t.price)) || 0;

                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (!isToppingDisabled) {
                          handleToggleTopping(t.id);
                        }
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isToppingDisabled
                          ? 'bg-[#f4efe7] border-[#e8e2d7] opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#e4ede3] border-[#24523c] text-[#163d2c] cursor-pointer'
                          : 'bg-[#faf8f4] border-[#e8e2d7] text-[#44554b] hover:bg-[#f3eee5] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isToppingDisabled
                              ? 'border-gray-300 bg-gray-200'
                              : isSelected
                              ? 'border-[#163d2c] bg-[#163d2c] text-white'
                              : 'border-[#94a399] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-medium">
                          {t.name}{' '}
                          {isToppingOutOfStock && (
                            <span className="text-[10px] text-rose-600 font-semibold">(Hết)</span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[#163d2c]">
                        +{formatVND(priceNum)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. GHI CHÚ ĐỒ UỐNG (Drink note) */}
            <div className="mb-6">
              <label className="text-xs font-bold text-[#163d2c] uppercase tracking-wider block mb-2">
                Ghi chú cho Barista (Tùy chọn) {isOutOfStock && <span className="text-[11px] text-rose-600 font-normal normal-case">(Tạm khóa)</span>}
              </label>
              <input
                type="text"
                disabled={isOutOfStock}
                value={drinkNote}
                onChange={(e) => setDrinkNote(e.target.value)}
                placeholder={isOutOfStock ? "Món này hiện đang tạm hết hàng..." : "VD: Ít đá, 50% đường, mang đi..."}
                className="w-full text-xs px-4 py-3 rounded-xl border border-[#e8e2d7] bg-[#faf8f4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#163d2c] text-[#163d2c] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* 5. BẢNG TÍNH GIÁ CHI TIẾT (Price Breakdown) - Đúng chuẩn wireframe & Figma */}
            <div className={`bg-[#faf8f4] p-4 rounded-2xl border border-[#e8e2d7] space-y-2 mb-6 text-xs ${
              isOutOfStock ? 'opacity-60' : ''
            }`}>
              <div className="flex justify-between text-[#6e7d73]">
                <span>Giá gốc sản phẩm:</span>
                <span className="font-semibold text-[#14241b]">{formatVND(basePrice)}</span>
              </div>

              {sizeExtra > 0 && (
                <div className="flex justify-between text-[#6e7d73]">
                  <span>Phụ thu Size {sizeOption.size} ({sizeOption.label}):</span>
                  <span className="font-semibold text-[#163d2c]">+{formatVND(sizeExtra)}</span>
                </div>
              )}

              {toppingsExtra > 0 && (
                <div className="flex justify-between text-[#6e7d73]">
                  <span>Phụ thu Toppings ({selectedToppings.length} loại):</span>
                  <span className="font-semibold text-[#163d2c]">+{formatVND(toppingsExtra)}</span>
                </div>
              )}

              <div className="flex justify-between text-[#163d2c] pt-2 border-t border-[#eae5dc] font-bold">
                <span>Đơn giá 1 ly:</span>
                <span>{formatVND(unitPrice)}</span>
              </div>
            </div>

            {/* 6. ĐIỀU CHỈNH SỐ LƯỢNG VÀ TỔNG TIỀN */}
            <div className="flex items-center justify-between gap-4 pt-2">
              {/* Bộ đếm số lượng (khóa khi món hết hàng) */}
              <div
                className={`flex items-center border border-[#d2ded1] rounded-2xl bg-[#faf8f4] p-1 shadow-xs ${
                  isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={handleDecreaseQty}
                  disabled={isOutOfStock || quantity <= 1}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[#163d2c] hover:bg-[#e4ede3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <span className="w-10 text-center font-bold text-sm text-[#163d2c]">
                  {isOutOfStock ? 0 : quantity}
                </span>
                <button
                  type="button"
                  onClick={handleIncreaseQty}
                  disabled={isOutOfStock}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[#163d2c] hover:bg-[#e4ede3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Nút Thêm vào giỏ hàng (căn giữa chữ và ẩn 0đ khi hết hàng) */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center ${
                  isOutOfStock
                    ? 'bg-neutral-400 text-neutral-100 cursor-not-allowed justify-center shadow-none'
                    : 'bg-[#163d2c] hover:bg-[#1a4734] text-white cursor-pointer justify-between active:scale-[0.99]'
                }`}
              >
                <span>
                  {isOutOfStock
                    ? 'Món này tạm hết hàng'
                    : existingCartItem
                    ? 'Cập nhật giỏ hàng'
                    : 'Thêm vào giỏ'}
                </span>
                {/* Chỉ hiện giá tiền khi món CÒN HÀNG */}
                {!isOutOfStock && (
                  <span className="font-serif font-bold text-base text-[#d6955b]">
                    {formatVND(totalPrice)}
                  </span>
                )}
              </button>
            </div>

            {existingCartItem && (
              <p className="text-[11px] text-[#708076] text-center mt-3">
                Món này đang có trong giỏ hàng. Cập nhật sẽ thay đổi cấu hình món trong giỏ của bạn.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
