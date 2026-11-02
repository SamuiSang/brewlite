'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  ArrowRight,
  Loader2,
  Lock,
  QrCode,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
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
  const [paymentMethod] = useState<'vnpay'>('vnpay');




  const [isProcessing, setIsProcessing] = useState(false);


  // QR Modal states (Task 8 & Task 10 - Webhook 2 bước)
  const [qrModal, setQrModal] = useState<{
    paymentId: string;
    orderId: string;
    amount: number;
    qrPayload: string;
    qrCodeUrl: string;
    qrDataUrl: string;

    vnpayUrl: string;
    orderCode?: string;
  } | null>(null);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);


  // Task 10.2 — Idempotency key
  // Sinh UUID 1 lần khi component mount. Gửi kèm POST /payments qua header
  // Idempotency-Key để backend nhận biết request trùng (double-click / retry)
  // và chỉ xử lý đúng 1 lần. Reset UUID mới sau khi thanh toán thất bại.
  const idempotencyKeyRef = useRef<string>('');

  const { items, getTotalItems, getSubtotal, getDiscount, getTotal, createOrder, authToken, authUser, profile, updateProfile, appliedVoucher, useLoyaltyPoints, setUseLoyaltyPoints } = useCartStore();

  useEffect(() => {
    setMounted(true);
    // Task 10.2: sinh UUID phía client, an toàn với SSR/prerender
    idempotencyKeyRef.current = crypto.randomUUID();
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
  const maxPointsDiscount = Math.min(availablePoints * 1000, Math.max(0, subtotal - discount));
  const pointsUsed = useLoyaltyPoints ? Math.ceil(maxPointsDiscount / 1000) : 0;
  const pointsDiscount = useLoyaltyPoints ? pointsUsed * 1000 : 0;
  const finalTotal = Math.max(0, baseTotal - pointsDiscount);
  const pointsToEarn = Math.floor(finalTotal / 10000);

  // Điền sẵn thông tin từ tài khoản đã đăng nhập
  useEffect(() => {
    if (authUser && authUser.fullName) {
      setCustomerName(authUser.fullName);

    }
  }, [authUser]);

  // Hủy giao dịch khi người dùng đóng modal (bấm X) hoặc hủy thanh toán
  const handleCancelPayment = async () => {
    if (!qrModal) return;
    const paymentId = qrModal.paymentId;
    setQrModal(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          paymentId,
          outcome: 'FAILED',
          transactionRef: 'USER_CANCELLED',
        }),
      });
    } catch (err) {
      console.error('Lỗi khi hủy giao dịch:', err);
    }
    router.push('/payment-failed');
  };

  // Tự động kiểm tra trạng thái thanh toán VNPAY (polling mỗi 2 giây khi modal đang mở)
  useEffect(() => {
    if (!qrModal) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiUrl}/payments/${qrModal.paymentId}/qr`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'SUCCESS') {
            clearInterval(interval);
            setWebhookStatus('success');
            createOrder({
              customerName: customerName || authUser?.fullName || 'Khách hàng',
              phoneNumber,
              orderNote,
              paymentMethod: 'Cổng thanh toán VNPAY Sandbox',
            });
            if (pointsUsed > 0 && updateProfile && profile) {
              updateProfile({ points: Math.max(0, profile.points - pointsUsed) });
            }
            setTimeout(() => {
              setQrModal(null);
              router.push(`/order-success?orderId=${qrModal.orderId}`);
            }, 800);
          } else if (data.status === 'FAILED') {
            clearInterval(interval);
            setQrModal(null);
            router.push('/payment-failed');
          }
        }
      } catch (err) {
        console.error('Polling payment status error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [qrModal, customerName, authUser, phoneNumber, orderNote, createOrder, pointsUsed, updateProfile, profile, router]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bắt buộc người dùng phải đăng nhập mới được thanh toán
    if (!authToken || !authUser) {
      router.push('/signin?redirect=/checkout');
      return;
    }

    setIsProcessing(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Header xác thực bắt buộc gửi kèm JWT token của tài khoản đang đăng nhập
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    };
    // Task 10.2: Gắn idempotency-key vào mọi request thanh toán
    authHeaders['Idempotency-Key'] = idempotencyKeyRef.current;

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
            promotionCode: appliedVoucher?.code || undefined,
            useLoyaltyPoints: pointsUsed,
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
        const payRes = await fetch(`${apiUrl}/payments`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            orderId: backendOrderId,
            method: 'VNPAY',
            twoStep: true,
          }),
        });
        const payData = await payRes.json();
        setIsProcessing(false);
        setQrModal({
          paymentId: payData.paymentId,
          orderId: backendOrderId,
          amount: finalTotal,
          qrPayload: payData.qrPayload || payData.vnpayUrl || '',
          qrCodeUrl: payData.qrCodeUrl || '',
          qrDataUrl: payData.qrDataUrl || '',
          vnpayUrl: payData.vnpayUrl || '',
          orderCode: payData.orderCode || ('#' + backendOrderId.slice(-4)),
        });
        return;
      }
    } catch (err: any) {
      console.error('Lỗi kết nối API:', err);
      setIsProcessing(false);
      alert('Lỗi thanh toán: ' + (err?.message || 'Không thể kết nối máy chủ'));
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

            {/* Payment Method Card - VNPAY Sandbox */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Phương thức thanh toán
                </h2>
                <span className="bg-[#e4ede3] text-[#163d2c] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#c5dec3]">
                  VNPAY Sandbox
                </span>
              </div>

              {/* Selected VNPAY Gateway Option */}
              <div className="p-4 rounded-2xl border border-[#2f664a] bg-[#e3ede1] text-[#163d2c] flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full border border-[#163d2c] bg-[#163d2c] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-[#14241b]">
                        Cổng thanh toán VNPAY Sandbox
                      </span>
                      <span className="bg-[#163d2c] text-[#e3ede1] text-[9px] font-bold px-2 py-0.5 rounded-md">
                        2 bước qua Webhook
                      </span>
                    </div>
                    <p className="text-[11px] text-[#42614e] mt-0.5">
                      Thanh toán qua quét mã VNPAY-QR hoặc thẻ ATM / tài khoản ngân hàng NCB Sandbox
                    </p>
                  </div>
                </div>
                <QrCode className="w-6 h-6 text-[#163d2c] shrink-0" />
              </div>

              {/* Sandbox info callout */}
              <div className="bg-[#f7f5f0] border border-[#e4ded4] rounded-2xl p-4 text-xs text-[#204a35] space-y-2">
                <div className="flex items-center gap-2 font-bold text-[#163d2c]">
                  <ShieldCheck className="w-4 h-4 text-[#266345]" />
                  <span>Cơ chế Thanh toán 2 bước (Chống lỗi tự gán PAID)</span>
                </div>
                <p className="text-[11px] text-[#4b6b58] leading-relaxed">
                  Đơn hàng được khởi tạo ở trạng thái <strong>PENDING</strong> kèm mã VNPAY-QR. Chỉ khi Cổng VNPAY Sandbox gửi Webhook Callback (IPN) xác nhận, đơn hàng mới chuyển sang <strong>PAID</strong> và cộng điểm thưởng Loyalty.
                </p>
                <div className="bg-white rounded-xl p-3 border border-[#ded7cb] text-[11px] space-y-1 text-[#2d4034]">
                  <div className="flex justify-between">
                    <span className="text-[#687a6f]">Mã Website (vnp_TmnCode):</span>
                    <code className="font-bold text-[#163d2c]">8VXIB1MM</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#687a6f]">Ngân hàng Sandbox:</span>
                    <strong className="text-[#14241b]">NCB (Ngân hàng Quốc Dân)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#687a6f]">Thẻ test VNPAY:</span>
                    <span className="font-mono font-bold text-[#163d2c]">9704 1985 2619 1432 198</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#708076] pt-1 border-t border-[#f0ebe0]">
                    <span>Tên: <strong>NGUYEN VAN A</strong></span>
                    <span>Hạn: <strong>07/15</strong></span>
                    <span>OTP: <strong>123456</strong></span>
                  </div>
                </div>
              </div>
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
                        1 điểm = 1.000đ
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
                      disabled={availablePoints <= 0 || (subtotal - discount) <= 0}
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
                    <span>Khuyến mãi {appliedVoucher ? `(${appliedVoucher.code})` : ''}</span>
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
                    <span>Thanh toán {formatVND(finalTotal)}</span>
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
          {/* VNPAY Sandbox QR Payment Modal (2-Step Webhook) */}
          {qrModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-[#e8e2d7] relative animate-in fade-in zoom-in-95 duration-200">
                {/* Close Button X: Bấm X thoát khỏi chỗ quét mã là thất bại */}
                <button
                  type="button"
                  onClick={handleCancelPayment}
                  title="Hủy thanh toán và thoát"
                  className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#f4efe7] hover:bg-[#ebdccf] text-[#853434] flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Modal Header */}
                <div className="text-center pb-3 border-b border-[#f0ebe0]">
                  <span className="bg-[#e4ede3] text-[#163d2c] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full inline-block mb-2">
                    Trạng thái: PENDING (Chờ xác nhận VNPAY)
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                    Thanh toán VNPAY Sandbox
                  </h3>
                  <p className="text-xs text-[#708076] mt-1">
                    Số tiền: <strong className="text-[#163d2c] font-bold">{formatVND(qrModal.amount)}</strong> · Mã đơn: {qrModal.orderCode}
                  </p>
                </div>

                {/* VNPAY QR Code Display */}
                <div className="bg-[#fcfbf9] border border-[#e8e2d7] rounded-2xl p-4 flex flex-col items-center justify-center my-3">
                  <div className="text-center">
                    <img
                      src={qrModal.qrDataUrl || qrModal.qrCodeUrl}
                      alt="VNPAY Sandbox QR Code"
                      className="w-56 h-56 object-contain rounded-xl shadow-xs border border-[#e0dad0] mx-auto p-2 bg-white"
                    />
                    <p className="text-[11px] text-[#2d4034] font-semibold mt-2.5">
                      Mã VNPAY-QR Sandbox (Ký số HMAC-SHA512)
                    </p>
                    <p className="text-[10px] text-[#708076] mt-0.5">
                      Quét mã bằng Camera / Ứng dụng VNPAY hoặc bấm nút bên dưới để thanh toán
                    </p>
                  </div>
                </div>

                {/* Test credentials info */}
                <div className="bg-[#f4efe7] rounded-2xl p-2.5 text-[10px] text-[#4d5e53] mb-4 space-y-1">
                  <div className="flex justify-between">
                    <span>Cổng thanh toán:</span>
                    <strong className="text-[#14241b]">VNPAY Sandbox (Test)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Mã Website (vnp_TmnCode):</span>
                    <strong className="text-[#14241b]">8VXIB1MM</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Thẻ test NCB:</span>
                    <span className="font-mono text-[#163d2c] font-bold">9704 1985 2619 1432 198</span>
                  </div>
                  <div className="flex justify-between text-[#708076] pt-0.5 border-t border-[#e2dacf]">
                    <span>Tên: <strong>NGUYEN VAN A</strong></span>
                    <span>Hạn: <strong>07/15</strong></span>
                    <span>OTP: <strong>123456</strong></span>
                  </div>
                </div>

                {/* Status notice */}
                {webhookStatus === 'success' && (
                  <div className="bg-[#e4ede3] border border-[#b8d4bb] text-[#163d2c] p-2.5 rounded-xl mb-3 flex items-center gap-2 text-xs font-bold animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-[#24523c] shrink-0" />
                    <span>Thanh toán VNPAY thành công! Đang chuyển hướng...</span>
                  </div>
                )}

                {/* Action Buttons: Chỉ giữ nút mở VNPAY và nút Hủy thoát */}
                <div className="space-y-2">
                  <a
                    href={qrModal.vnpayUrl}
                    className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-center"
                  >
                    <span>Mở Cổng VNPAY Sandbox để thanh toán</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    type="button"
                    onClick={handleCancelPayment}
                    className="w-full bg-[#f4efe7] hover:bg-[#e8decb] text-[#853434] text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Hủy giao dịch (Thoát)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}