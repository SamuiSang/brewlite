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
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  ShieldCheck,
  X,
  Smartphone,
  CreditCard,
  Building2,
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ewallet'>('ewallet');
  const [cardholderName, setCardholderName] = useState('NGUYEN DUY');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [expiryDate, setExpiryDate] = useState('12 / 28');
  const [cvv, setCvv] = useState('•••');
  const [isProcessing, setIsProcessing] = useState(false);

  // Task 10.2 — Idempotency key
  // Sinh UUID 1 lần khi component mount. Gửi kèm POST /payments qua header
  // Idempotency-Key để backend nhận biết request trùng (double-click / retry)
  // và chỉ xử lý đúng 1 lần. Reset UUID mới sau khi thanh toán thất bại.
  const idempotencyKeyRef = useRef<string>('');

  // Task 8 (FE) & Task 10.2: Modal Cổng Thanh Toán QR Sandbox 2 bước
  const [sandboxSession, setSandboxSession] = useState<{
    paymentId: string;
    orderId: string;
    orderCode: string;
    amount: number;
    transactionRef: string;
    qrCodeUrl: string;
  } | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrGateway, setQrGateway] = useState<'VIETQR' | 'MOMO' | 'VNPAY'>('VIETQR');
  const [isSendingWebhook, setIsSendingWebhook] = useState<'success' | 'failed' | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(900); // Đếm ngược 15:00 phút

  const {
    items,
    getTotalItems,
    getSubtotal,
    getDiscount,
    getTotal,
    createOrder,
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
    // Task 10.2: Sinh UUID phía client khi mount
    idempotencyKeyRef.current = crypto.randomUUID();
  }, []);

  // Kiểm tra đăng nhập: nếu chưa đăng nhập thì tự động chuyển hướng đến /signin
  useEffect(() => {
    if (mounted && (!authToken || !authUser)) {
      router.push('/signin?redirect=/checkout');
    }
  }, [mounted, authToken, authUser, router]);

  // Bộ đếm ngược thời gian cho mã QR Sandbox
  useEffect(() => {
    if (!isQrModalOpen) {
      setTimeLeft(900);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isQrModalOpen]);

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
      setCardholderName(authUser.fullName.toUpperCase());
    }
  }, [authUser]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  /**
   * BƯỚC 1: Xử lý khi bấm nút "Thanh toán" tại trang /checkout
   * - Tạo đơn hàng PENDING qua POST /orders
   * - Gọi POST /payments với { twoStep: true } và header Idempotency-Key
   * - Mở Modal Cổng Thanh Toán QR Sandbox (VietQR / MoMo / VNPay)
   */
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bắt buộc người dùng phải đăng nhập mới được thanh toán
    if (!authToken || !authUser) {
      router.push('/signin?redirect=/checkout');
      return;
    }

    setIsProcessing(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Header xác thực bắt buộc gửi kèm JWT token và Idempotency-Key (Task 10.2)
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      'Idempotency-Key': idempotencyKeyRef.current,
    };

    let backendOrderId = '';
    let orderCode = '';

    try {
      // 1. Lấy danh sách sản phẩm từ DB để map ID thực tế
      const prodRes = await fetch(`${apiUrl}/products`);
      const dbProducts: DbProduct[] = await prodRes.json();
      const defaultProductId = dbProducts[0]?.id;

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

        const createdOrder = await orderRes.json();
        backendOrderId = createdOrder.id || '';
        orderCode = createdOrder.orderCode || createdOrder.id || '';
      }

      // 2. Gọi POST /payments với twoStep: true và header Idempotency-Key để khởi tạo cổng QR Sandbox
      if (backendOrderId) {
        const payRes = await fetch(`${apiUrl}/payments`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            orderId: backendOrderId,
            method: paymentMethod === 'card' ? 'CARD' : 'MOMO',
            twoStep: true,
            idempotencyKey: idempotencyKeyRef.current,
          }),
        });

        if (payRes.ok) {
          const payData = await payRes.json();
          setSandboxSession({
            paymentId: payData.paymentId || backendOrderId,
            orderId: payData.orderId || backendOrderId,
            orderCode: payData.orderCode || orderCode || '1043',
            amount: payData.amount || finalTotal,
            transactionRef:
              payData.transactionRef ||
              `SANDBOX_${(payData.paymentId || 'TXN').slice(0, 8).toUpperCase()}`,
            qrCodeUrl: payData.qrCodeUrl || '',
          });
        }
      }
    } catch (err) {
      console.error('Lỗi kết nối API khởi tạo thanh toán:', err);
    }

    // Fallback sandbox session nếu API backend mock offline
    setSandboxSession((prev) => {
      if (prev) return prev;
      const fallbackCode = orderCode || `BW${Date.now().toString().slice(-6)}`;
      return {
        paymentId: backendOrderId || fallbackCode,
        orderId: backendOrderId || fallbackCode,
        orderCode: fallbackCode,
        amount: finalTotal,
        transactionRef: `SANDBOX_${Date.now().toString().slice(-8)}`,
        qrCodeUrl: '',
      };
    });

    setIsProcessing(false);

    // Mở Modal Cổng Thanh Toán QR Sandbox (Bước 2)
    setIsQrModalOpen(true);
  };

  /**
   * BƯỚC 2: Xử lý nút giả lập Webhook của Bên thứ 3 trên Modal Sandbox
   * - "Xác nhận đã quét QR (Gửi Webhook SUCCESS)" -> gọi POST /payments/webhook với status SUCCESS
   * - "Giả lập lỗi/Hủy giao dịch (Gửi Webhook FAILED)" -> gọi POST /payments/webhook với status FAILED
   * Sau đó chuyển trang phù hợp (/orders/[id] hoặc /payment-failed)
   */
  const handleConfirmWebhook = async (status: 'SUCCESS' | 'FAILED') => {
    setIsSendingWebhook(status === 'SUCCESS' ? 'success' : 'failed');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      // Gọi webhook backend mô phỏng thông báo kết quả từ ngân hàng/ví điện tử
      await fetch(`${apiUrl}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          paymentId: sandboxSession?.paymentId || 'UNKNOWN',
          idempotencyKey: idempotencyKeyRef.current,
          outcome: status,
          transactionRef: sandboxSession?.transactionRef,
          orderId: sandboxSession?.orderId,
          orderCode: sandboxSession?.orderCode,
          status,
          method: qrGateway,
          amount: finalTotal,
          event: status === 'SUCCESS' ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
          reason: status === 'FAILED' ? 'SIMULATED_FAILURE_OR_USER_CANCEL' : undefined,
        }),
      }).catch((err) => console.warn('Webhook call warning:', err));
    } catch (err) {
      console.warn('Lỗi gửi Webhook:', err);
    }

    if (status === 'SUCCESS') {
      const paymentDesc =
        paymentMethod === 'card'
          ? `Bank card · Visa ending in ${cardNumber.replace(/\s/g, '').slice(-4) || '4242'}`
          : `${qrGateway} · QR Sandbox`;

      const newOrderId = createOrder({
        customerName: customerName || authUser?.fullName || 'Khách hàng',
        phoneNumber,
        orderNote,
        paymentMethod: paymentDesc,
      });

      if (pointsUsed > 0 && updateProfile && profile) {
        updateProfile({ points: Math.max(0, profile.points - pointsUsed) });
      }

      setIsSendingWebhook(null);
      setIsQrModalOpen(false);
      setSandboxSession(null);
      router.push(`/orders/${newOrderId}`);
    } else {
      // Task 10.2: Reset idempotency-key khi thanh toán thất bại để lần thanh toán tiếp theo có key mới
      idempotencyKeyRef.current = crypto.randomUUID();
      setIsSendingWebhook(null);
      setIsQrModalOpen(false);
      setSandboxSession(null);
      router.push('/payment-failed');
    }
  };

  const handleCloseModal = () => {
    // Reset key và đóng modal nếu người dùng chủ động tắt
    idempotencyKeyRef.current = crypto.randomUUID();
    setIsQrModalOpen(false);
    setSandboxSession(null);
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

  // URL QR VietQR động
  const vietQrUrl =
    sandboxSession?.qrCodeUrl ||
    `https://api.vietqr.io/image/970422-0901234567-compact2.png?amount=${finalTotal}&addInfo=BREWLITE%20${sandboxSession?.orderCode || '1043'}&accountName=BREWLITE%20COFFEE`;

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
            Thanh toán an toàn qua Cổng QR Sandbox 2 bước (Task 8 & 10.2).
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
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#14241b]">
                  Chọn phương thức thanh toán
                </h2>
                <span className="text-[11px] font-semibold text-[#24523c] bg-[#e4ede3] px-2.5 py-0.5 rounded-full">
                  Cổng QR Sandbox 2 bước
                </span>
              </div>

              <div className="space-y-3">
                {/* E-wallet / QR Option */}
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
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-[#163d2c]" />
                      <span className="text-xs font-bold">Cổng QR Sandbox (VietQR / MoMo / VNPay)</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#708076]">Quét mã QR 2 bước</span>
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
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#163d2c]" />
                      <span className="text-xs font-bold">Thẻ ngân hàng & Cổng Sandbox</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#708076]">Visa / Mastercard</span>
                </button>
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
                  BƯỚC 1: KHỞI TẠO ĐƠN & THANH TOÁN
                </span>
                <p className="text-xs text-[#c2d1c7] leading-relaxed">
                  Bấm &quot;Thanh toán&quot; để tạo đơn hàng PENDING và mở Cổng Thanh Toán QR Sandbox 2 bước (MoMo / VNPay / VietQR).
                </p>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                id="pay-button"
                className="w-full bg-[#d6955b] hover:bg-[#c4844a] text-white text-xs font-bold py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang khởi tạo cổng thanh toán...</span>
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
                Cơ chế Idempotency-Key kích hoạt chống trùng lặp giao dịch (Task 10.2).
              </p>
            </div>
          </div>
        </form>

        {/* MODAL CỔNG THANH TOÁN QR SANDBOX (BƯỚC 2) */}
        {isQrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-[#e8e2d7] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="bg-[#163d2c] text-white p-5 sm:p-6 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="bg-[#d6955b] text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                      SANDBOX MODE (BƯỚC 2/2)
                    </span>
                    <span className="text-[11px] text-[#c2d1c7] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Hết hạn sau {formatTime(timeLeft)}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold">
                    Cổng Thanh Toán QR Sandbox
                  </h3>
                  <p className="text-xs text-[#a2b7aa] mt-0.5">
                    Đơn hàng #{sandboxSession?.orderCode} đang ở trạng thái PENDING. Quét QR hoặc giả lập Webhook để xác nhận.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
                {/* Gateway Selector Tabs */}
                <div>
                  <label className="block text-xs font-bold text-[#14241b] mb-2">
                    Chọn cổng thanh toán QR:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setQrGateway('VIETQR')}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                        qrGateway === 'VIETQR'
                          ? 'bg-[#e4ede3] border-[#163d2c] text-[#163d2c] shadow-xs'
                          : 'bg-[#f4efe7] border-transparent text-[#708076] hover:bg-[#eae3d7]'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>VietQR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrGateway('MOMO')}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                        qrGateway === 'MOMO'
                          ? 'bg-[#fce9f2] border-[#a50064] text-[#a50064] shadow-xs'
                          : 'bg-[#f4efe7] border-transparent text-[#708076] hover:bg-[#eae3d7]'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>MoMo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrGateway('VNPAY')}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                        qrGateway === 'VNPAY'
                          ? 'bg-[#e5f1fc] border-[#005baa] text-[#005baa] shadow-xs'
                          : 'bg-[#f4efe7] border-transparent text-[#708076] hover:bg-[#eae3d7]'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>VNPay</span>
                    </button>
                  </div>
                </div>

                {/* QR Code Card Display */}
                <div className="bg-[#f9f7f3] border border-[#e8e2d7] rounded-3xl p-5 flex flex-col items-center text-center">
                  <div className="relative w-48 h-48 bg-white p-3 rounded-2xl border border-[#ded5c7] shadow-sm flex items-center justify-center mb-3">
                    {qrGateway === 'VIETQR' ? (
                      // VietQR API image
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vietQrUrl}
                        alt="VietQR Code"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      // Mock visual SVG QR for MoMo / VNPay
                      <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <svg
                          className="w-36 h-36"
                          viewBox="0 0 100 100"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <rect width="100" height="100" fill="white" />
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M10 10H40V40H10V10ZM16 16H34V34H16V16ZM20 20H30V30H20V20ZM60 10H90V40H60V10ZM66 16H84V34H66V16ZM70 20H80V30H70V20ZM10 60H40V90H10V60ZM16 66H34V84H16V66ZM20 70H30V80H20V70ZM48 10H52V24H48V10ZM48 30H52V40H48V30ZM10 48H24V52H10V48ZM30 48H40V52H30V48ZM60 48H74V52H60V48ZM80 48H90V52H80V48ZM48 60H52V74H48V60ZM48 80H52V90H48V80ZM60 60H70V70H60V60ZM75 60H85V70H75V60ZM60 75H70V85H60V75ZM75 75H85V85H75V75ZM85 85H90V90H85V85ZM55 48H58V52H55V48ZM48 55H52V58H48V55Z"
                            fill={qrGateway === 'MOMO' ? '#a50064' : '#005baa'}
                          />
                        </svg>
                        <div
                          className={`absolute px-2 py-0.5 rounded text-[10px] font-black tracking-wider text-white shadow-xs ${
                            qrGateway === 'MOMO' ? 'bg-[#a50064]' : 'bg-[#005baa]'
                          }`}
                        >
                          {qrGateway}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#526658] font-medium">
                    Mở App Ngân hàng hoặc Ví <strong className="font-bold">{qrGateway}</strong> để quét mã
                  </p>
                  <p className="text-[11px] text-[#8ca094] mt-0.5">
                    Hệ thống sẽ tự động cập nhật khi nhận Webhook thành công
                  </p>
                </div>

                {/* Transfer Info Details */}
                <div className="bg-[#f4efe7] rounded-2xl p-4 space-y-2.5 text-xs text-[#14241b]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#6e8074]">Đơn vị thụ hưởng:</span>
                    <span className="font-bold text-[#163d2c]">BrewLite Coffee VN</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6e8074]">Số tiền thanh toán:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-serif text-sm text-[#163d2c]">
                        {formatVND(sandboxSession?.amount || finalTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy((sandboxSession?.amount || finalTotal).toString(), 'amount')
                        }
                        className="text-[#708076] hover:text-[#163d2c] cursor-pointer"
                        title="Sao chép số tiền"
                      >
                        {copiedField === 'amount' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6e8074]">Mã đơn hàng:</span>
                    <span className="font-mono font-semibold text-[#163d2c]">
                      #{sandboxSession?.orderCode}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#6e8074]">Mã giao dịch Sandbox:</span>
                    <span className="font-mono text-[11px] text-[#163d2c]">
                      {sandboxSession?.transactionRef}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-[#ded5c7]">
                    <span className="text-[#6e8074]">Nội dung chuyển khoản:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#163d2c]">
                        BREWLITE {sandboxSession?.orderCode}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(`BREWLITE ${sandboxSession?.orderCode}`, 'content')
                        }
                        className="text-[#708076] hover:text-[#163d2c] cursor-pointer"
                        title="Sao chép nội dung"
                      >
                        {copiedField === 'content' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Third-Party Webhook Simulator Panel */}
                <div className="border-t border-[#f0ebe0] pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-[#24523c]" />
                    <h4 className="text-xs font-bold text-[#14241b] uppercase tracking-wider">
                      Giả lập bên thứ 3 (Webhook Simulator)
                    </h4>
                  </div>
                  <p className="text-[11px] text-[#6e8074] mb-3 leading-relaxed">
                    Mô phỏng tín hiệu Webhook trả về từ Cổng Thanh Toán về API <code className="bg-[#f0ebe0] px-1 py-0.5 rounded text-[10px] font-mono">POST /payments/webhook</code> để hoàn tất đơn hàng:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Button 1: Webhook SUCCESS */}
                    <button
                      type="button"
                      disabled={isSendingWebhook !== null}
                      onClick={() => handleConfirmWebhook('SUCCESS')}
                      className="bg-[#163d2c] hover:bg-[#102f21] text-white py-3 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-60"
                    >
                      {isSendingWebhook === 'success' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang gửi Webhook...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#8fe3b2]" />
                          <span>Xác nhận đã quét QR (Gửi Webhook SUCCESS)</span>
                        </>
                      )}
                    </button>

                    {/* Button 2: Webhook FAILED */}
                    <button
                      type="button"
                      disabled={isSendingWebhook !== null}
                      onClick={() => handleConfirmWebhook('FAILED')}
                      className="bg-[#fce9e5] hover:bg-[#fbd3cc] border border-[#f3b5a9] text-[#b33e2a] py-3 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
                    >
                      {isSendingWebhook === 'failed' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang hủy đơn...</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-[#b33e2a]" />
                          <span>Giả lập lỗi/Hủy giao dịch (Gửi Webhook FAILED)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-[#f9f7f3] px-6 py-3 border-t border-[#e8e2d7] flex items-center justify-between text-[11px] text-[#708076]">
                <span>Task 8 (FE) & Task 10.2 · Idempotency Enabled</span>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="hover:text-[#163d2c] underline cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
