'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowRight, Loader2, Lock } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatVND } from '@/lib/data';
import QRCode from 'qrcode';

interface QrOrder {
  id: string;
  orderCode: string;
  totalAmount: string | number;
  pointsRedeemed: number;
  pointsEarned: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState('Nguyen Duy');
  const [phoneNumber, setPhoneNumber] = useState('090 123 4567');
  const [orderNote, setOrderNote] = useState('Vui lòng gọi tên tôi khi đơn hàng sẵn sàng.');
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrOrder, setQrOrder] = useState<QrOrder | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentKey, setPaymentKey] = useState('');
  const started = useRef(false);

  const { items, getTotalItems, getSubtotal, getDiscount, getTotal, clearCart, appliedVoucher, authToken, authUser, profile, updateProfile } = useCartStore();

  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

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
  const baseTotal = mounted ? getTotal() : 119000;

  const availablePoints = mounted ? (profile?.points ?? 120) : 120;
  const maxPointsDiscount = Math.min(availablePoints * 500, Math.max(0, subtotal - discount));
  const pointsUsed = useLoyaltyPoints ? Math.ceil(maxPointsDiscount / 500) : 0;
  const pointsDiscount = useLoyaltyPoints ? maxPointsDiscount : 0;
  const finalTotal = Math.max(0, baseTotal - pointsDiscount);
  const pointsToEarn = Math.floor(finalTotal / 10000);

  // Điền sẵn thông tin từ tài khoản đã đăng nhập
  useEffect(() => {
    if (authUser && authUser.fullName) {
      setCustomerName(authUser.fullName);
    }
  }, [authUser]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  };

  const handlePay = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isProcessing || qrOrder) return;
    if (!authToken || !authUser) {
      router.push('/signin?redirect=/checkout');
      return;
    }
    if (!items.length) {
      setPaymentError('Giỏ hàng không được để trống');
      return;
    }
    setIsProcessing(true);
    setPaymentError('');
    try {
      const response = await fetch(`${apiUrl}/orders`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          customerName, phone: phoneNumber, notes: orderNote,
          promotionCode: appliedVoucher?.code,
          useLoyaltyPoints: pointsUsed,
          items: items.map((item) => ({
            productId: item.drinkId, size: item.size, qty: item.quantity,
            toppingIds: item.toppings,
          })),
        }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.message || 'Không thể tạo đơn hàng');
      setQrOrder(order);
      setPaymentKey(crypto.randomUUID());
      updateProfile({ points: Math.max(0, profile.points - order.pointsRedeemed) });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Không thể kết nối backend');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!mounted || !authToken || !authUser || !items.length || started.current) return;
    started.current = true;
    void handlePay();
  }, [mounted, authToken, authUser, items.length]);

  useEffect(() => {
    if (!qrOrder) return;
    // Non-bank payload: scanning cannot initiate a real transfer.
    QRCode.toDataURL(JSON.stringify({
      type: 'BREWLITE_MOCK_PAYMENT', orderId: qrOrder.id,
      amount: Number(qrOrder.totalAmount), currency: 'VND',
    }), { width: 256, margin: 4 }).then(setQrImage).catch(() => {
      setPaymentError('Không thể tạo ảnh QR. Đơn đã được giữ; vui lòng thử lại hoặc hủy đơn.');
    });
  }, [qrOrder]);

  const confirmQr = async (success: boolean) => {
    if (!qrOrder || isProcessing) return;
    setIsProcessing(true);
    setPaymentError('');
    try {
      const response = await fetch(`${apiUrl}/payments`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ orderId: qrOrder.id, method: 'BANK_TRANSFER',
          idempotencyKey: paymentKey, mockSuccess: success }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Không thể xác nhận thanh toán');
      if (!result.success) {
        setPaymentKey(crypto.randomUUID());
        setPaymentError('Giả lập thanh toán thất bại. Có thể quét lại cùng đơn hoặc hủy đơn.');
        return;
      }
      updateProfile({ points: profile.points + qrOrder.pointsEarned });
      clearCart();
      router.push(`/orders/${qrOrder.orderCode.replace(/^#/, '')}`);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Không thể kết nối backend');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelQr = async () => {
    if (!qrOrder || isProcessing) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${apiUrl}/orders/${qrOrder.id}/cancel`, {
        method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Không thể hủy đơn');
      updateProfile({ points: profile.points + qrOrder.pointsRedeemed });
      router.push('/cart');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Không thể hủy đơn');
    } finally {
      setIsProcessing(false);
    }
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

            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs space-y-4">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">Thanh toán QR giả lập</h2>
              <p className="text-sm text-[#66776c]">Tạo đơn để nhận mã QR, sau đó chọn kết quả quét mô phỏng. Không chuyển tiền thật, không cần thông tin thẻ.</p>
              {paymentError && <p role="alert" className="text-sm text-red-700">{paymentError}</p>}
              {qrOrder && (
                <div className="rounded-2xl bg-[#f4efe7] p-5 text-center space-y-4" aria-live="polite">
                  <p className="font-bold text-[#163d2c]">Đơn {qrOrder.orderCode}</p>
                  {qrImage ? <img src={qrImage} width={256} height={256} alt={`Mã QR giả lập cho đơn ${qrOrder.orderCode}`} className="mx-auto rounded-xl" /> : <p>Đang tạo mã QR...</p>}
                  <p className="text-xl font-bold text-[#163d2c]">{formatVND(Number(qrOrder.totalAmount))}</p>
                  <p className="text-xs text-[#66776c]">QR chỉ chứa thông tin đơn thử nghiệm, không phải mã chuyển khoản ngân hàng.</p>
                  <button type="button" disabled={isProcessing} onClick={() => confirmQr(true)} className="w-full rounded-xl bg-[#163d2c] text-white p-3 font-bold disabled:opacity-50">Giả lập quét thành công</button>
                  <button type="button" disabled={isProcessing} onClick={() => confirmQr(false)} className="w-full rounded-xl border border-[#ded5c7] p-3 text-sm disabled:opacity-50">Giả lập thanh toán thất bại</button>
                  <button type="button" disabled={isProcessing} onClick={cancelQr} className="text-sm text-red-700 underline disabled:opacity-50">Hủy đơn và hoàn nguyên liệu, điểm thưởng</button>
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

              {/* Dùng điểm thưởng */}
              <div className="pt-4 border-t border-[#f0ebe0]">
                <div className="p-3.5 bg-[#f4f7f5] rounded-2xl border border-[#d8e5dd] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-xs text-[#14241b]">
                        Dùng điểm tích lũy
                      </p>
                      <span className="text-[10px] bg-[#d6ede0] text-[#1e583d] font-bold px-1.5 py-0.5 rounded-full">
                        1 điểm = 500đ
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6e8074] mt-0.5">
                      Điểm hiện có: <strong className="text-[#24523c] font-bold">{availablePoints}</strong>
                      {availablePoints > 0 && ` (giảm tối đa ${formatVND(maxPointsDiscount)})`}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useLoyaltyPoints}
                      disabled={started.current || !!qrOrder || availablePoints <= 0 || (subtotal - discount) <= 0}
                      onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                      className="w-4 h-4 accent-[#24523c] rounded cursor-pointer disabled:opacity-50"
                    />
                  </label>
                </div>
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

                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-[#266345]">
                    <span>Đổi điểm thưởng ({pointsUsed} điểm)</span>
                    <span className="font-semibold">-{formatVND(pointsDiscount)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#f0ebe0] flex items-baseline justify-between">
                  <span className="text-xs text-[#6e8074] font-medium">Tổng cộng</span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                    {formatVND(finalTotal)}
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
                disabled={isProcessing || !!qrOrder || !items.length}
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
                    <span>{qrOrder ? 'Đang chờ quét QR' : 'Thử lại thanh toán'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="bg-[#1f4a36] text-[#d6ede0] rounded-xl py-2 px-3 text-center text-[11px] border border-[#2d6148]">
                <span>Tích lũy thêm <strong className="text-white font-bold">+{pointsToEarn} điểm</strong> sau khi hoàn tất đơn.</span>
              </div>

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