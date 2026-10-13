'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ArrowRight, Check } from 'lucide-react';
import { DRINKS, formatVND } from '@/lib/data';
import { useCartStore } from '@/lib/store';

export default function CustomizeContent({ drinkId }: { drinkId: string }) {
  const router = useRouter();

  const drink = useMemo(() => {
    return DRINKS.find((d) => d.id === drinkId) || DRINKS[0];
  }, [drinkId]);

  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  // Check if this drink is already in the cart
  const existingCartItem = cartItems.find((it) => it.drinkId === drink.id);

  // Selected customization state
  const [selectedSize, setSelectedSize] = useState<'S' | 'M' | 'L'>('L');
  const [selectedMilk, setSelectedMilk] = useState<string>('oat');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [drinkNote, setDrinkNote] = useState<string>('Less sweet, please.');
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    if (existingCartItem) {
      setSelectedSize(existingCartItem.size);
      setSelectedMilk(existingCartItem.milk);
      setSelectedToppings(existingCartItem.toppings || []);
      setDrinkNote(existingCartItem.note || '');
      setQuantity(existingCartItem.quantity || 1);
    }
  }, [existingCartItem]);

  // Pricing calculations
  const sizeOption = drink.sizes.find((s) => s.size === selectedSize) || drink.sizes[0];
  const sizeExtra = sizeOption.extra;

  const toppingsExtra = selectedToppings.reduce((sum, topId) => {
    const topping = drink.toppings.find((t) => t.id === topId);
    return sum + (topping ? topping.price : 0);
  }, 0);

  const unitPrice = drink.basePrice + sizeExtra + toppingsExtra;
  const totalPrice = unitPrice * quantity;

  const handleToggleTopping = (topId: string) => {
    setSelectedToppings((prev) =>
      prev.includes(topId) ? prev.filter((id) => id !== topId) : [...prev, topId]
    );
  };

  const handleAddToCart = () => {
    const milkOption = drink.milkOptions.find((m) => m.id === selectedMilk);
    const toppingsLabels = selectedToppings
      .map((tId) => drink.toppings.find((t) => t.id === tId)?.label)
      .filter(Boolean) as string[];

    const optionsLabelParts = [sizeOption.label, milkOption?.label];
    if (toppingsLabels.length > 0) {
      optionsLabelParts.push(...toppingsLabels);
    }

    addItem({
      drinkId: drink.id,
      name: drink.name,
      subtitle: drink.subtitle,
      image: drink.image,
      size: selectedSize,
      sizeLabel: sizeOption.label,
      milk: selectedMilk,
      milkLabel: milkOption?.label || 'Sữa tiêu chuẩn',
      toppings: selectedToppings,
      toppingsLabels,
      note: drinkNote,
      unitPrice,
      quantity,
      optionsLabel: optionsLabelParts.join(' · '),
    });

    router.push('/cart');
  };

  return (
    <div className="flex-1 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Breadcrumb */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-[#163d2c]">
            Menu
          </Link>
          <span>/</span>
          <span className="hover:text-[#163d2c]">{drink.category}</span>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">{drink.name}</span>
        </div>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Tùy chỉnh ly cà phê theo sở thích của bạn..
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Chọn theo sở thích, tận hưởng từng ngụm ngon.
          </p>
        </div>

        {/* Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Drink Card */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="bg-[#163d2c] text-white rounded-3xl overflow-hidden border border-[#234d39] shadow-sm">
              <div className="relative w-full aspect-[4/3] bg-[#224b37]">
                <Image
                  src={drink.largeImage || drink.image}
                  alt={drink.name}
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="p-6 sm:p-7">
                <div className="flex items-center gap-2 mb-3">
                  {drink.bestseller && (
                    <span className="bg-[#f8f5ee] text-[#163d2c] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                      BÁN CHẠY
                    </span>
                  )}
                  <span className="bg-[#24523c] text-[#d6ede0] text-[10px] font-medium px-2.5 py-1 rounded-full">
                    {drink.category}
                  </span>
                </div>

                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-3">
                  {drink.name}
                </h2>

                <p className="text-xs sm:text-sm text-[#c2d1c7] leading-relaxed mb-6">
                  {drink.description}
                </p>

                <div className="font-serif text-xl sm:text-2xl font-bold text-[#d6955b] mb-4">
                  Giá từ {formatVND(drink.basePrice)}
                </div>

                <p className="text-[11px] text-[#8ca094]">
                  {drink.tags.join(' · ')}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#6e8074] px-1">
              Nhận đồ tại Brewlite · Quận 3. Đồ uống sẽ sẵn sàng sau khoảng 8–12 phút kể từ khi thanh toán.
            </p>
          </div>

          {/* Right Column: Customization Options */}
          <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e2d7] shadow-xs flex flex-col gap-6">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
              Tạo dấu ấn riêng cho thức uống yêu thích.
            </h3>

            {/* Choose Size */}
            <div>
              <label className="block text-xs font-bold text-[#163d2c] mb-3">
                Chọn kích cỡ
              </label>
              <div className="grid grid-cols-3 gap-3">
                {drink.sizes.map((s) => {
                  const isSelected = selectedSize === s.size;
                  return (
                    <button
                      key={s.size}
                      type="button"
                      onClick={() => setSelectedSize(s.size)}
                      className={`p-3 sm:p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#163d2c] text-white border-[#163d2c] shadow-xs'
                          : 'bg-[#f4efe7] text-[#14241b] border-transparent hover:border-[#ded5c7]'
                      }`}
                    >
                      <span className={`font-serif text-xl font-bold ${isSelected ? 'text-[#d6955b]' : 'text-[#163d2c]'}`}>
                        {s.size}
                      </span>
                      <span className="text-[11px] font-medium mt-1">
                        {s.label}
                      </span>
                      <span className={`text-[11px] font-semibold mt-0.5 ${isSelected ? 'text-[#c2d1c7]' : 'text-[#6e8074]'}`}>
                        {formatVND(s.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Milk Preference */}
            <div>
              <label className="block text-xs font-bold text-[#163d2c] mb-3">
                Chọn loại sữa
              </label>
              <div className="flex flex-col gap-2.5">
                {drink.milkOptions.map((milk) => {
                  const isSelected = selectedMilk === milk.id;
                  return (
                    <button
                      key={milk.id}
                      type="button"
                      onClick={() => setSelectedMilk(milk.id)}
                      className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-[#e3ede1] border-[#2f664a] text-[#163d2c]'
                          : 'bg-[#f4efe7] border-transparent hover:border-[#ded5c7] text-[#14241b]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-[#163d2c] bg-[#163d2c]'
                              : 'border-[#98a99e] bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <span className="text-xs font-semibold">{milk.label}</span>
                      </div>
                      <span className="text-[11px] text-[#708076]">{milk.tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toppings - Optional */}
            <div>
              <label className="block text-xs font-bold text-[#163d2c] mb-3">
                 Topping
              </label>
              <div className="flex flex-col gap-2.5">
                {drink.toppings.map((top) => {
                  const isChecked = selectedToppings.includes(top.id);
                  return (
                    <button
                      key={top.id}
                      type="button"
                      onClick={() => handleToggleTopping(top.id)}
                      className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                        isChecked
                          ? 'bg-[#e3ede1] border-[#2f664a] text-[#163d2c]'
                          : 'bg-[#f4efe7] border-transparent hover:border-[#ded5c7] text-[#14241b]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChecked
                              ? 'border-[#163d2c] bg-[#163d2c] text-white'
                              : 'border-[#98a99e] bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-semibold">{top.label}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#546b5a]">
                        +{formatVND(top.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drink Note - Optional */}
            <div>
              <label className="block text-xs font-bold text-[#163d2c] mb-2">
                Ghi chú đồ uống · Không bắt buộc
              </label>
              <input
                type="text"
                value={drinkNote}
                onChange={(e) => setDrinkNote(e.target.value)}
                placeholder="VD: Ít ngọt, nóng hơn..."
                className="w-full bg-[#f4efe7] text-xs text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
              />
            </div>

            {/* Price Breakdown */}
            <div className="pt-3 border-t border-[#f0ebe0] text-xs text-[#6e8074] space-y-2">
              <div className="flex justify-between">
                <span>Giá gốc</span>
                <span className="font-medium text-[#14241b]">{formatVND(drink.basePrice)}</span>
              </div>
              {sizeExtra > 0 && (
                <div className="flex justify-between">
                  <span>{sizeOption.label} size</span>
                  <span className="font-medium text-[#14241b]">+{formatVND(sizeExtra)}</span>
                </div>
              )}
              {selectedToppings.length > 0 ? (
                selectedToppings.map((topId) => {
                  const t = drink.toppings.find((item) => item.id === topId);
                  if (!t) return null;
                  return (
                    <div key={topId} className="flex justify-between">
                      <span>{t.label}</span>
                      <span className="font-medium text-[#14241b]">+{formatVND(t.price)}</span>
                    </div>
                  );
                })
              ) : (
                <div className="flex justify-between">
                  <span>
                    {selectedMilk === 'oat' ? 'Sữa yến mạch' : 'Sữa tươi'} · Không topping
                  </span>
                  <span className="font-medium text-[#14241b]">0₫</span>
                </div>
              )}
            </div>

            {/* Total Drink Price & Actions */}
            <div className="pt-4 border-t border-[#f0ebe0]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-[#6e8074] font-medium">Thành tiền</span>
                <span className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                  {formatVND(totalPrice)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Quantity Stepper */}
                <div className="flex items-center bg-[#f4efe7] rounded-2xl p-1 shrink-0 border border-[#e8dfd2]">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#163d2c] hover:bg-[#e7dfd2] active:scale-95 transition-all cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold text-[#14241b]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#163d2c] hover:bg-[#e7dfd2] active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Add / Update Cart Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <span>
                    {existingCartItem ? 'Cập nhật giỏ hàng' : 'Thêm vào giỏ hàng'} · {formatVND(totalPrice)}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {existingCartItem && (
                <p className="text-[11px] text-[#6c7d71] text-center mt-3">
                   Đang chỉnh sửa {existingCartItem.name} trong giỏ hàng. Giỏ hàng hiện có {cartItems.length} sản phẩm.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
