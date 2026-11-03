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
  AlertCircle,
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
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orderNote, setOrderNote] = useState('Vui lòng gọi tên tôi khi đơn hàng sẵn sàng.');
  const [orderError, setOrderError] = useState('');
  const [paymentMethod] = useState<'vnpay'>('vnpay');

  const [isProcessing, setIsProcessing] = useState(false);

  // QR Modal states (Task 8 & Task 10 - Webhook 2 bước VNPAY)
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
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  // Task 10.2 — Idempotency key
  // Sinh UUID 1 lần khi component mount. Gửi kèm POST /payments qua header
  // Idempotency-Key để backend nhận biết request trùng (double-click / retry)
  // và chỉ xử lý đúng 1 lần. Reset UUID mới sau khi thanh toán thất bại.
  const idempotencyKeyRef = useRef<string>('');

  const {
    items,
    getTotalItems,
    getSubtotal,
    getDiscount,
    getTotal,
    createOrder,
    clearCart,
    authToken,
    authUser,
    profile,
    updateProfile,
    appliedVoucher,
    useLoyaltyPoints,
    setUseLoyaltyPoints,
  } = useCartStore();

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

  const availablePoints = mounted ? (profile?.points ?? 0) : 0;
  const maxPointsDiscount = Math.min(availablePoints * 1000, Math.max(0, subtotal - discount));
  const pointsUsed = useLoyaltyPoints ? Math.ceil(maxPointsDiscount / 1000) : 0;
  const pointsDiscount = useLoyaltyPoints ? pointsUsed * 1000 : 0;
  const finalTotal = Math.max(0, baseTotal - pointsDiscount);
  const pointsToEarn = Math.floor(finalTotal / 10000);

  // Điền sẵn thông tin từ tài khoản đã đăng nhập
  useEffect(() => {
    if (authUser) {
      if (authUser.fullName) {
        setCustomerName(authUser.fullName);
      }
      if (authUser.phone) {
        setPhoneNumber(authUser.phone);
      }
    }
    if (profile) {
      if (profile.name) setCustomerName(profile.name);
      if (profile.phone) setPhoneNumber(profile.phone);
    }
  }, [authUser, profile]);

  // Hủy giao dịch khi người dùng đóng modal (bấm X) hoặc hủy thanh toán
  const handleCancelPayment = async () => {
    if (!qrModal) return;
    const paymentId = qrModal.paymentId;
    const orderId = qrModal.orderId;
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
    router.push(`/payment-failed?orderId=${orderId}&code=99`);
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
            clearCart();
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
            router.push(`/payment-failed?orderId=${qrModal.orderId}&code=99`);
          }
        }
      } catch (err) {
        console.error('Polling payment status error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [qrModal, customerName, authUser, phoneNumber, orderNote, createOrder, pointsUsed, updateProfile, profile, router, clearCart]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');

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
      'Idempotency-Key': idempotencyKeyRef.current,
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
            promotionCode: appliedVoucher?.code || undefined,
            useLoyaltyPoints: pointsUsed,
            items:
              items.length > 0
                ? items.map((it) => ({
                    productId:
                      dbProducts.find(
                        (p) =>
                          p.id === it.drinkId ||
                          p.name.toLowerCase() === it.name.toLowerCase(),
                      )?.id || it.drinkId || defaultProductId,
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

        const orderData = await orderRes.json();

        if (!orderRes.ok) {
          setIsProcessing(false);
          setOrderError(
            Array.isArray(orderData.message)
              ? orderData.message.join(', ')
              : orderData.message || 'Không thể tạo đơn hàng'
          );
          return;
        }

        backendOrderId = orderData.id;
      }

      // 2. Gọi POST /payments để khởi tạo thanh toán 2 bước qua VNPAY Sandbox
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
      setOrderError('Lỗi kết nối máy chủ: ' + (err?.message || 'Vui lòng thử lại sau.'));
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
            Xác nhận đơn hàng
          </h1>
          <p className="text-xs sm:text-sm text-[#66776c] mt-2">
            Thanh toán an toàn qua cổng VNPAY Sandbox và nhận đồ uống tại quầy.
          </p>
        </div>

        {/* Error banner */}
        {orderError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-xs font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-bold mb-0.5">Không thể tạo đơn hàng:</strong>
              <span>{orderError}</span>
            </div>
          </div>
        )}

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
                    placeholder="Nhập họ và tên..."
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
                    placeholder="Nhập số điện thoại..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#163d2c] mb-1.5">
                    Ghi chú cho Barista
                  </label>
                  <input
                    type="text"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Ví dụ: Ít đá, không đường..."
                    className="w-full bg-[#f4efe7] text-xs font-semibold text-[#14241b] rounded-2xl px-4 py-3 border border-transparent focus:border-[#163d2c] focus:bg-white focus:outline-none transition-all"
                  />
                </div>
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
                    <span>Thẻ test NCB:</span>
                    <strong className="font-mono text-[#163d2c]">9704 1985 2619 1432 198</strong>
                  </div>
                  <div className="flex justify-between text-[#708076]">
                    <span>Tên chủ thẻ: <strong>NGUYEN VAN A</strong></span>
                    <span>Hạn: <strong>07/15</strong> · OTP: <strong>123456</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d7] shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Tóm tắt đơn hàng
                </h2>
                <span className="bg-[#ede7dc] text-[#55695c] text-xs font-semibold px-2.5 py-1 rounded-full">
                  {totalItems} món
                </span>
              </div>

              {/* Voucher section */}
              <div className="border border-[#ded7cb] bg-[#faf8f4] p-3.5 rounded-2xl space-y-1.5">
                <span className="text-[10px] font-bold text-[#55695c] uppercase tracking-wider block">
                  Mã khuyến mãi (Voucher)
                </span>
                {appliedVoucher ? (
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-[#163d2c]">{appliedVoucher.code}</span>
                      <p className="text-[10px] text-[#708076]">{appliedVoucher.description}</p>
                    </div>
                    <span className="font-semibold text-[#2f664a]">-{formatVND(discount)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-[#708076] flex justify-between items-center">
                    <span>Chưa áp dụng voucher</span>
                    <Link href="/cart" className="text-[#163d2c] font-bold hover:underline text-[11px]">
                      Chọn ở giỏ hàng →
                    </Link>
                  </div>
                )}
              </div>

              {/* Loyalty Points Redemption Toggle */}
              {availablePoints > 0 && (
                <div className="bg-[#f2eee7] p-3.5 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-[#14241b] block">
                      Dùng điểm tích lũy ({availablePoints} điểm)
                    </span>
                    <span className="text-[10px] text-[#708076]">
                      {useLoyaltyPoints
                        ? `Đang dùng ${pointsUsed} điểm (giảm ${formatVND(pointsDiscount)})`
                        : `Có thể giảm tối đa ${formatVND(maxPointsDiscount)}`}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={useLoyaltyPoints}
                    onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                    className="w-4 h-4 accent-[#163d2c] cursor-pointer"
                  />
                </div>
              )}

              {/* Total breakdown */}
              <div className="pt-3 border-t border-[#f0ebe0] space-y-2 text-xs text-[#708076]">
                <div className="flex justify-between">
                  <span>Tạm tính</span>
                  <span className="font-medium text-[#14241b]">{formatVND(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#2f664a]">
                    <span>Ưu đãi voucher</span>
                    <span>-{formatVND(discount)}</span>
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-[#2f664a]">
                    <span>Giảm từ điểm thưởng ({pointsUsed} điểm)</span>
                    <span>-{formatVND(pointsDiscount)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-[#f0ebe0] flex items-baseline justify-between">
                  <span className="text-xs text-[#708076] font-medium">Tổng thanh toán</span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-[#14241b]">
                    {formatVND(finalTotal)}
                  </span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-[#f7f5f0] border border-[#e4ded4] rounded-2xl p-4">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#163d2c] block mb-1">
                  Chính sách đơn hàng
                </span>
                <p className="text-[11px] text-[#55695c] leading-relaxed">
                  Đã bao gồm ưu đãi thành viên. Chúng tôi sẽ bắt đầu pha chế ngay sau khi thanh toán VNPAY được xác nhận.
                </p>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                id="pay-button"
                className="w-full bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang khởi tạo thanh toán VNPAY...</span>
                  </>
                ) : (
                  <>
                    <span>Thanh toán {formatVND(finalTotal)} qua VNPAY</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-[#708076]">
                <Lock className="w-3.5 h-3.5 text-[#55695c]" />
                <span>Cổng VNPAY Sandbox chính thức · Bảo mật chuẩn PCI-DSS</span>
              </div>
            </div>
          </div>

          {/* VNPAY QR & Webhook Modal */}
          {qrModal && (
            <div className="fixed inset-0 z-50 bg-[#14241b]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[#e8e2d7] shadow-2xl relative animate-in zoom-in-95">
                {/* Close Button X */}
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
                    <span>Hạn: <strong>07/15</strong> · OTP: <strong>123456</strong></span>
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