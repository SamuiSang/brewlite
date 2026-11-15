'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, Minus, Plus, Check, AlertCircle, Coffee } from 'lucide-react';
import { formatVND } from '@/lib/data';
import { CartItem } from '@/lib/store';
import {
  fetchProductById,
  fetchToppings,
  NormalizedProduct,
  ApiTopping,
  FALLBACK_TOPPINGS,
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
  shortLabel: string;
}

const MILK_OPTIONS: MilkOption[] = [
  { id: 'dairy', label: 'Sữa tươi thanh trùng (Dairy milk)', shortLabel: 'Sữa tươi thanh trùng' },
  { id: 'oat', label: 'Sữa yến mạch nguyên chất (Oat milk)', shortLabel: 'Sữa yến mạch nguyên chất' },
];

export interface DrinkCustomizeModalProps {
  drinkId: string | null;
  initialProduct?: NormalizedProduct | null;
  editingCartItem?: CartItem | null;
  onClose: () => void;
  onConfirm: (item: Omit<CartItem, 'id'>) => void;
}

export default function DrinkCustomizeModal({
  drinkId,
  initialProduct,
  editingCartItem,
  onClose,
  onConfirm,
}: DrinkCustomizeModalProps) {
  const isOpen = Boolean(drinkId);

  const [product, setProduct] = useState<NormalizedProduct | null>(initialProduct || null);
  const [availableToppings, setAvailableToppings] = useState<ApiTopping[]>(FALLBACK_TOPPINGS);
  const [isLoadingProduct, setIsLoadingProduct] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  const [selectedSize, setSelectedSize] = useState<'S' | 'M' | 'L'>('S');
  const [selectedMilk, setSelectedMilk] = useState<string | null>('dairy');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [drinkNote, setDrinkNote] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Đồng bộ trạng thái form mỗi khi mở modal cho món mới hoặc món trong giỏ
  useEffect(() => {
    if (!drinkId) return;

    setImageError(false);
    setProduct(initialProduct || null);

    if (editingCartItem) {
      setSelectedSize(editingCartItem.size || 'S');
      setSelectedMilk(editingCartItem.milk || null);
      setSelectedToppings(editingCartItem.toppings || []);
      setDrinkNote(editingCartItem.note || '');
      setQuantity(editingCartItem.quantity || 1);
    } else {
      setSelectedSize('S');
      setSelectedMilk('dairy');
      setSelectedToppings([]);
      setDrinkNote('');
      setQuantity(1);
    }
  }, [drinkId, initialProduct, editingCartItem]);

  // Nạp dữ liệu sản phẩm (tồn kho / BOM) và danh sách topping mới nhất từ API
  const loadData = useCallback(async (id: string) => {
    setIsLoadingProduct((prev) => (!initialProduct ? true : prev));
    try {
      const [prodData, toppingsData] = await Promise.all([
        fetchProductById(id),
        fetchToppings(),
      ]);
      if (prodData) {
        setProduct(prodData);
      }
      if (toppingsData && toppingsData.length > 0) {
        setAvailableToppings(toppingsData);
      }
    } catch (err) {
      console.error('Lỗi khi tải tùy chỉnh đồ uống:', err);
    } finally {
      setIsLoadingProduct(false);
    }
  }, [initialProduct]);

  useEffect(() => {
    if (drinkId) {
      void loadData(drinkId);
    }
  }, [drinkId, loadData]);

  // Khóa cuộn nền và hỗ trợ phím Escape để đóng modal
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const outOfStockIngredients = useMemo(() => {
    if (!product?.recipeItems || product.recipeItems.length === 0) return [];
    return product.recipeItems.filter(
      (item) => item.ingredient && (item.ingredient.stock ?? 0) < item.amount,
    );
  }, [product]);

  const isOutOfStock = Boolean(
    product && ((product.stock ?? 0) <= 0 || outOfStockIngredients.length > 0),
  );

  const sizeOption = SIZES.find((s) => s.size === selectedSize) || SIZES[0];
  const sizeExtra = sizeOption.extra;

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

  // Khi đang tải product từ giỏ hàng, tạm suy ra basePrice từ unitPrice hiện có để tránh nhảy giá về 0đ
  const fallbackBasePrice = useMemo(() => {
    if (!editingCartItem) return 0;
    const oldSizeExtra = SIZES.find((s) => s.size === editingCartItem.size)?.extra || 0;
    const oldToppingsExtra = (editingCartItem.toppings || []).reduce((sum, topId) => {
      const t = availableToppings.find((x) => x.id === topId);
      const p = t ? (typeof t.price === 'number' ? t.price : parseFloat(String(t.price)) || 0) : 0;
      return sum + p;
    }, 0);
    return Math.max(0, editingCartItem.unitPrice - oldSizeExtra - oldToppingsExtra);
  }, [editingCartItem, availableToppings]);

  const basePrice = product ? product.basePrice : fallbackBasePrice;
  const unitPrice = basePrice + sizeExtra + toppingsExtra;
  const totalPrice = unitPrice * quantity;

  if (!isOpen || !drinkId) return null;

  const displayName = product?.name || editingCartItem?.name || 'Đang tải đồ uống...';
  const displaySubtitle = product?.subtitle || editingCartItem?.subtitle || '';
  const displayCategory = product?.category || 'BrewLite';
  const displayImage = imageError
    ? '/images/drinks/hero-drink.png'
    : product?.largeImage || product?.image || editingCartItem?.image || '/images/drinks/hero-drink.png';

  const handleToggleTopping = (topId: string) => {
    setSelectedToppings((prev) =>
      prev.includes(topId) ? prev.filter((id) => id !== topId) : [...prev, topId],
    );
  };

  const handleSubmit = () => {
    if (isOutOfStock) return;

    const milkOption = selectedMilk ? MILK_OPTIONS.find((m) => m.id === selectedMilk) : null;
    const toppingsLabels = selectedToppings
      .map((tId) => availableToppings.find((t) => t.id === tId)?.name)
      .filter(Boolean) as string[];

    const optionsLabelParts = [`${sizeOption.size} (${sizeOption.label})`];
    if (milkOption) {
      optionsLabelParts.push(milkOption.shortLabel);
    }
    if (toppingsLabels.length > 0) {
      optionsLabelParts.push(...toppingsLabels);
    }

    onConfirm({
      drinkId: product?.id || drinkId,
      name: displayName,
      subtitle: displaySubtitle,
      image: product?.image || editingCartItem?.image || '/images/drinks/hero-drink.png',
      size: selectedSize,
      sizeLabel: sizeOption.label,
      milk: selectedMilk || '',
      milkLabel: milkOption?.label || 'Mặc định',
      toppings: [...selectedToppings],
      toppingsLabels,
      note: drinkNote.trim(),
      unitPrice,
      quantity,
      optionsLabel: optionsLabelParts.join(' · '),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#14241b]/45 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Tùy chỉnh ${displayName}`}
    >
      {/* Khung hình chữ nhật đứng (Portrait Modal) */}
      <div
        className="relative w-full max-w-[430px] max-h-[88vh] bg-white rounded-3xl border border-[#e8e2d7] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header ảnh món nhỏ gọn */}
        <div className="relative h-40 shrink-0 bg-[#163d2c]">
          <Image
            src={displayImage}
            alt={displayName}
            fill
            sizes="430px"
            className="object-cover"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#102a1f]/90 via-[#102a1f]/35 to-black/15" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng tùy chỉnh"
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xs text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>

          <div className="absolute bottom-3.5 left-5 right-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-white/20 backdrop-blur-xs text-[#f7f4ee] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {displayCategory}
              </span>
              {isOutOfStock && (
                <span className="bg-rose-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Tạm hết hàng
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-xl font-bold leading-snug truncate">
                {displayName}
              </h2>
              <span className="font-serif text-base font-bold text-[#f3cfa8] shrink-0">
                {formatVND(basePrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Nội dung tùy chọn có thể cuộn */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoadingProduct && !product && (
            <div className="flex items-center gap-2 text-xs text-[#6e7d73] bg-[#faf8f4] px-3 py-2 rounded-xl border border-[#e8e2d7]">
              <Coffee className="w-3.5 h-3.5 animate-pulse text-[#163d2c]" />
              <span>Đang đồng bộ công thức và tồn kho...</span>
            </div>
          )}

          {isOutOfStock && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Món này hiện tạm hết hàng</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  {outOfStockIngredients.length > 0
                    ? `Kho đang thiếu: ${outOfStockIngredients.map((i) => i.ingredient?.name || 'Nguyên liệu').join(', ')}.`
                    : 'Quán tạm thời chưa thể pha chế món này.'}
                </p>
              </div>
            </div>
          )}

          {/* 1. Kích cỡ ly */}
          <div>
            <label className="text-[11px] font-bold text-[#163d2c] uppercase tracking-wider block mb-2.5">
              Kích cỡ ly (Size)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {SIZES.map((s) => {
                const isSelected = !isOutOfStock && selectedSize === s.size;
                const itemPrice = basePrice + s.extra;
                return (
                  <button
                    key={s.size}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => !isOutOfStock && setSelectedSize(s.size)}
                    className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center ${
                      isOutOfStock
                        ? 'bg-[#f4efe7] border-[#e8e2d7] opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#163d2c] text-white border-[#163d2c] shadow-sm cursor-pointer'
                        : 'bg-[#faf8f4] hover:bg-[#f0ebe1] text-[#33443a] border-[#e8e2d7] cursor-pointer'
                    }`}
                  >
                    <span className="font-serif text-lg font-bold leading-none mb-1">{s.size}</span>
                    <span
                      className={`text-[10px] font-medium ${
                        isSelected ? 'text-[#c2d1c7]' : 'text-[#708076]'
                      }`}
                    >
                      {s.label}
                    </span>
                    <span
                      className={`text-[11px] font-semibold mt-1 ${
                        isSelected ? 'text-[#f3cfa8]' : 'text-[#163d2c]'
                      }`}
                    >
                      {formatVND(itemPrice)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Loại sữa */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-[#163d2c] uppercase tracking-wider">
                Loại sữa pha chế
              </label>
              <span className="text-[11px] text-[#708076]">Tùy chọn</span>
            </div>
            <div className="space-y-2">
              {MILK_OPTIONS.map((m) => {
                const isSelected = !isOutOfStock && selectedMilk === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() =>
                      !isOutOfStock && setSelectedMilk((prev) => (prev === m.id ? null : m.id))
                    }
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all text-left ${
                      isOutOfStock
                        ? 'bg-[#f4efe7] border-[#e8e2d7] opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#e4ede3] border-[#24523c] text-[#163d2c] cursor-pointer'
                        : 'bg-[#faf8f4] border-[#e8e2d7] text-[#55695c] hover:bg-[#f3eee5] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-[#163d2c] bg-[#163d2c]'
                            : 'border-[#94a399] bg-white'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                      <span className="text-xs font-semibold">{m.label}</span>
                    </div>
                    <span className="text-[10px] text-[#708076] font-medium shrink-0">Bao gồm</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Thêm Topping */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-[#163d2c] uppercase tracking-wider">
                Thêm Topping ({selectedToppings.length} đã chọn)
              </label>
              <span className="text-[11px] text-[#708076]">Chọn nhiều</span>
            </div>
            <div className="space-y-2">
              {availableToppings.map((t) => {
                const isSelected = selectedToppings.includes(t.id);
                const isToppingOutOfStock =
                  t.isAvailable === false ||
                  (t.stock !== undefined && t.stock !== null && t.stock <= 0);
                const isToppingDisabled = isOutOfStock || isToppingOutOfStock;
                const priceNum =
                  typeof t.price === 'number' ? t.price : parseFloat(String(t.price)) || 0;

                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={isToppingDisabled}
                    onClick={() => !isToppingDisabled && handleToggleTopping(t.id)}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all text-left ${
                      isToppingDisabled
                        ? 'bg-[#f4efe7] border-[#e8e2d7] opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#e4ede3] border-[#24523c] text-[#163d2c] cursor-pointer'
                        : 'bg-[#faf8f4] border-[#e8e2d7] text-[#44554b] hover:bg-[#f3eee5] cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isToppingDisabled
                            ? 'border-gray-300 bg-gray-200'
                            : isSelected
                            ? 'border-[#163d2c] bg-[#163d2c] text-white'
                            : 'border-[#94a399] bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span className="text-xs font-medium truncate">
                        {t.name}{' '}
                        {isToppingOutOfStock && (
                          <span className="text-[10px] text-rose-600 font-semibold">(Hết)</span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#163d2c] shrink-0 ml-2">
                      +{formatVND(priceNum)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Ghi chú */}
          <div>
            <label className="text-[11px] font-bold text-[#163d2c] uppercase tracking-wider block mb-2">
              Ghi chú cho Barista (Tùy chọn)
            </label>
            <input
              type="text"
              disabled={isOutOfStock}
              value={isOutOfStock ? '' : drinkNote}
              onChange={(e) => setDrinkNote(e.target.value)}
              placeholder="VD: Ít đá, 50% đường, mang đi..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#e8e2d7] bg-[#faf8f4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#163d2c] text-[#163d2c] disabled:opacity-50"
            />
          </div>
        </div>

        {/* Footer tính tiền & Xác nhận */}
        <div className="shrink-0 border-t border-[#efeae0] bg-[#fbf9f5] px-5 py-3.5 space-y-2.5">
          {(sizeExtra > 0 || toppingsExtra > 0) && !isOutOfStock && (
            <div className="flex items-center justify-between text-[11px] text-[#6e7d73]">
              <span>
                Đơn giá 1 ly
                {selectedToppings.length > 0 ? ` (${selectedToppings.length} topping)` : ''}
              </span>
              <span className="font-semibold text-[#163d2c]">{formatVND(unitPrice)}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center border border-[#d2ded1] rounded-xl bg-white p-0.5 shadow-2xs ${
                isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => (q > 1 ? q - 1 : 1))}
                disabled={isOutOfStock || quantity <= 1}
                aria-label="Giảm số lượng"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#163d2c] hover:bg-[#e4ede3] disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <span className="w-8 text-center font-bold text-xs text-[#163d2c] tabular-nums">
                {isOutOfStock ? 0 : quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(q + 1, 9999))}
                disabled={isOutOfStock}
                aria-label="Tăng số lượng"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#163d2c] hover:bg-[#e4ede3] disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <button
              type="button"
              disabled={isOutOfStock}
              onClick={handleSubmit}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center ${
                isOutOfStock
                  ? 'bg-neutral-400 text-neutral-100 cursor-not-allowed justify-center shadow-none'
                  : 'bg-[#163d2c] hover:bg-[#102f21] text-white cursor-pointer justify-between active:scale-[0.99]'
              }`}
            >
              <span>
                {isOutOfStock
                  ? 'Tạm hết hàng'
                  : editingCartItem
                  ? 'Cập nhật món'
                  : 'Thêm vào giỏ'}
              </span>
              {!isOutOfStock && (
                <span className="font-serif font-bold text-sm text-[#f3cfa8]">
                  {formatVND(totalPrice)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
