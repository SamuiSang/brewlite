'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowRight, Loader2, Lock } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatVND } from '@/lib/data';

interface DbProduct {
  id: string;
  name: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState('Nguyen Duy');
  const [phoneNumber, setPhoneNumber] = useState('090 123 4567');
  const [orderNote, setOrderNote] = useState('Vui lòng gọi tên tôi khi đơn hàng sẵn sàng.');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ewallet'>('card');
  const [cardholderName, setCardholderName] = useState('NGUYEN DUY');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiryDate, setExpiryDate] = useState('12 / 28');
  const [cvv, setCvv] = useState('•••');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mockOutcome, setMockOutcome] = useState<'success' | 'failed'>('success');

  const { items, getTotalItems, getSubtotal, getDiscount, getTotal, createOrder, authToken, authUser } = useCartStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Kiểm tra đăng nhập: nếu chưa đăng nhập thì tự động chuyển hướng đến /signin
  useEffect(() => {
    if (mounted && (!authToken || !authUser)) {
      router.push('/signin?redirect=/checkout');
    }
  }, [mounted, authToken, authUser, router]);

  const totalItems = mounted ? getTotalItems() : 2;
  const subtotal = mounted ? getSubtotal() : 124000;
  const discount = mounted ? getDiscount() : 5000;
  const total = mounted ? getTotal() : 119000;

  // Điền sẵn thông tin từ tài khoản đã đăng nhập
  useEffect(() => {
    if (authUser && authUser.fullName) {
      setCustomerName(authUser.fullName);
      setCardholderName(authUser.fullName.toUpperCase());
    }
  }, [authUser]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bắt buộc người dùng phải đăng nhập mới được thanh toán
    if (!authToken || !authUser) {
      router.push('/signin?redirect=/checkout');
      return;
    }

    setIsProcessing(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const isSuccess = mockOutcome === 'success' && cvv !== '000';

    // Header xác thực bắt buộc gửi kèm JWT token của tài khoản đang đăng nhập
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    };

    try {
      // 1. Lấy danh sách sản phẩm từ DB để map ID thực tế
      const prodRes = await fetch(`${apiUrl}/products`);
      const dbProducts: DbProduct[] = await prodRes.json();
      const defaultProductId = dbProducts[0]?.id;

      let backendOrderId = '';

      if (defaultProductId) {
        // Tạo đơn hàng trạng thái PENDING trên Backend (gửi kèm JWT và userId)
        const orderRes = await fetch(`${apiUrl}/orders`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            userId: authUser.id,
            customerName: customerName || authUser.fullName,
            phone: phoneNumber,
            notes: orderNote,
            items:
              items.length > 0
                ? items.map((it) => ({
                    productId:
                      dbProducts.find((p) => p.name === it.name)?.id || defaultProductId,
                    size: it.size,
                    qty: it.quantity,
                  }))
                : [{ productId: defaultProductId, size: 'M', qty: 1 }],
          }),
        });

        if (orderRes.status === 401) {
          setIsProcessing(false);
          router.push('/signin?redirect=/checkout');
          return;
        }

        const createdOrder: { id: string } = await orderRes.json();
        backendOrderId = createdOrder.id;
      }

      // 2. Gọi POST /payments để xử lý Mock Payment
      if (backendOrderId) {
        await fetch(`${apiUrl}/payments`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            orderId: backendOrderId,
            method: paymentMethod === 'card' ? 'CARD' : 'MOMO',
            mockSuccess: isSuccess,
          }),
        });
      }
    } catch (err) {
      console.error('Lỗi kết nối API:', err);
    }

    // 3. Điều hướng trên Frontend dựa vào kết quả thanh toán
    if (!isSuccess) {
      setIsProcessing(false);
      router.push('/payment-failed');
      return;
    }

    const paymentDesc =
      paymentMethod === 'card'
        ? `Bank card · Visa ending in ${cardNumber.replace(/\s/g, '').slice(-4) || '4242'}`
        : 'E-wallet · MoMo / ZaloPay';

    const newOrderId = createOrder({
      customerName: customerName || authUser.fullName,
      phoneNumber,
      orderNote,
      paymentMethod: paymentDesc,
    });

    setTimeout(() => {
      router.push(`/orders/${newOrderId}`);
    }, 500);
  };

  // Nếu đã mount nhưng chưa đăng nhập, hiển thị thông báo yêu cầu đăng nhập
  if (mounted && (!authToken || !authUser)) {
    return (
      <div className="flex-1 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-[#e8e2d7] shadow-sm text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#e4ede3] border border-[#d2ded1] flex items-center justify-center text-[#163d2c] mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#14241b] mb-2">
            Yêu cầu đăng nhập
          </h2>
          <p className="text-xs text-[#66776c] mb-6 leading-relaxed">
            Bạn cần đăng nhập tài khoản thành viên để tiếp tục đặt hàng và thanh toán.
          </p>
          <Link
            href="/signin?redirect=/checkout"
            className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>Đăng nhập ngay</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/cart"
            className="mt-4 text-xs text-[#738478] hover:text-[#163d2c] font-medium"
          >
            Quay lại giỏ hàng
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
          <Link href="/cart" className="hover:text-[#163d2c]">
            Giỏ hàng
          </Link>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">Thanh toán</span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#14241b] tracking-tight leading-tight">
            Chỉ còn một bước nữa để thưởng thức cà phê ngon!
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Thanh toán an toàn và nhận đơn hàng tại quầy.
          </p>
        </div>

        {/* Grid */}
        <form onSubmit={handlePay} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Pickup Details & Payment */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Pickup Details Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Thông tin nhận hàng
              </h2>

              {/* Location Badge */}
              <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-2xl p-4 flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-[#d5e3d4] border border-[#bed2bd] flex items-center justify-center text-[#163d2c] shrink-0">
                  <MapPin className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#546b5a] block">
                    ĐỊA ĐIỂM NHẬN HÀNG
                  </span>
                  <h4 className="font-semibold text-xs text-[#163d2c]">
                    Brewlite · Quận 3
                  </h4>
                  <p className="text-[11px] text-[#526658]">
                    Dự kiến sẵn sàng sau 8–12 phút.
                  </p>
                  <p className="text-[10px] text-[#697f70]">
                    Vui lòng nhận hàng tại quầy. Không hỗ trợ giao hàng.
                  </p>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Số điện thoại *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                  Ghi chú đơn hàng · Không bắt buộc
                </label>
                <input
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Ghi chú cho nhân viên pha chế..."
                  className="w-full bg-[#f4efe7] text-xs text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Choose How to Pay Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                Chọn phương thức thanh toán
              </h2>

              <div className="space-y-3">
                {/* E-wallet Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ewallet')}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                    paymentMethod === 'ewallet'
                      ? 'bg-[#e3ede1] border-[#2f664a] text-[#163d2c]'
                      : 'bg-[#f4efe7] border-transparent hover:border-[#ded5c7] text-[#14241b]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === 'ewallet'
                          ? 'border-[#163d2c] bg-[#163d2c]'
                          : 'border-[#98a99e] bg-white'
                      }`}
                    >
                      {paymentMethod === 'ewallet' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-xs font-bold">Ví điện tử</span>
                  </div>
                  <span className="text-[11px] text-[#708076]">MoMo / ZaloPay</span>
                </button>

                {/* Bank Card Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer border ${
                    paymentMethod === 'card'
                      ? 'bg-[#e3ede1] border-[#2f664a] text-[#163d2c]'
                      : 'bg-[#f4efe7] border-transparent hover:border-[#ded5c7] text-[#14241b]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === 'card'
                          ? 'border-[#163d2c] bg-[#163d2c]'
                          : 'border-[#98a99e] bg-white'
                      }`}
                    >
                      {paymentMethod === 'card' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="text-xs font-bold">Thẻ ngân hàng</span>
                  </div>
                  <span className="text-[11px] text-[#708076]">Visa / Mastercard</span>
                </button>
              </div>

              <div className="pt-3 border-t border-[#f0ebe0]">
                <label className="block text-xs font-bold text-[#163d2c] mb-2">
                  Chế độ giả lập (Mock Payment)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMockOutcome('success')}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      mockOutcome === 'success'
                        ? 'bg-[#e3ede1] border-[#2f664a] text-[#163d2c]'
                        : 'bg-[#f4efe7] border-transparent text-[#708076]'
                    }`}
                  >
                    ✅ Giả lập Thành công (PAID)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMockOutcome('failed')}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      mockOutcome === 'failed'
                        ? 'bg-[#fce9e5] border-[#b33e2a] text-[#b33e2a]'
                        : 'bg-[#f4efe7] border-transparent text-[#708076]'
                    }`}
                  >
                    ❌ Giả lập Thất bại (FAILED)
                  </button>
                </div>
              </div>

              {/* Card Inputs (if Bank card selected) */}
              {paymentMethod === 'card' && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                      Tên chủ thẻ
                    </label>
                    <input
                      type="text"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                      className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                      Số thẻ
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all tracking-wider"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                        Ngày hết hạn
                      </label>
                      <input
                        type="text"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                        Mã bảo mật CVV
                      </label>
                      <input
                        type="password"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#78887e]">
                    Thông tin thẻ của bạn được mã hóa. Chúng tôi không lưu mã bảo mật CVV.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary & Pay Button */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Your Order Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Đơn hàng của bạn
                </h2>
                <span className="bg-[#ede7dc] text-[#55695c] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {totalItems} món
                </span>
              </div>

              {/* Items summary */}
              <div className="divide-y divide-[#f2eee7]">
                {(items.length > 0
                  ? items
                  : [
                      {
                        id: 'demo-1',
                        name: 'Brown Sugar Latte',
                        optionsLabel: 'Large · Oat milk',
                        quantity: 1,
                        unitPrice: 65000,
                        image: '/images/brown-sugar-latte.png',
                      },
                      {
                        id: 'demo-2',
                        name: 'Flat White',
                        optionsLabel: 'Regular · Extra shot',
                        quantity: 1,
                        unitPrice: 59000,
                        image: '/images/flat-white.png',
                      },
                    ]
                ).map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#e8e2d8] shrink-0 border border-[#eee8df]">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif text-sm font-bold text-[#14241b] truncate">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-[#708076]">
                        {item.optionsLabel}
                      </p>
                      <p className="text-[10px] text-[#8ca094]">
                        Số lượng {item.quantity}
                      </p>
                    </div>
                    <span className="font-serif text-sm font-bold text-[#14241b]">
                      {formatVND(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Subtotal, discount & total */}
              <div className="pt-4 border-t border-[#f0ebe0] space-y-2 text-xs text-[#6e8074]">
                <div className="flex justify-between">
                  <span>Tạm tính · {totalItems} món</span>
                  <span className="font-semibold text-[#14241b]">{formatVND(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-[#266345]">
                    <span>Ưu đãi thành viên</span>
                    <span className="font-semibold">-{formatVND(discount)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#f0ebe0] flex items-baseline justify-between">
                  <span className="text-xs text-[#6e8074] font-medium">Tổng cộng</span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                    {formatVND(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Dark Green Pay Card */}
            <div className="bg-[#163d2c] text-white rounded-3xl p-6 sm:p-7 border border-[#234d39] shadow-sm flex flex-col gap-4">
              <div>
                <span className="bg-[#24523c] text-[#d6ede0] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full inline-block mb-3">
                  CHỜ THANH TOÁN
                </span>
                <p className="text-xs text-[#c2d1c7] leading-relaxed">
                  Đã bao gồm ưu đãi thành viên . Chúng tôi sẽ bắt đầu pha chế sau khi thanh toán được xác nhận.
                </p>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                id="pay-button"
                className="w-full bg-[#d6955b] hover:bg-[#c4844a] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xử lý thanh toán...</span>
                  </>
                ) : (
                  <>
                    <span>Thanh toán {formatVND(total)}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-[10px] text-[#8ca094] leading-relaxed text-center">
                Khi thanh toán, bạn đồng ý với các điều khoản đặt hàng của chúng tôi. Chỉ hỗ trợ thanh toán không tiền mặt và nhận hàng tại quầy.
              </p>
            </div>

            <p className="text-[11px] text-[#78887e] px-2 leading-relaxed">
              Điểm thưởng sẽ được cộng sau khi thanh toán thành công, không phải khi đơn hàng còn đang chờ xử lý.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}