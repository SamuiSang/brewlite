'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import OrderDetailsContent from '../orders/[id]/OrderDetailsContent';

function OrderSuccessInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const authToken = useCartStore((state) => state.authToken);
  const userId = useCartStore((state) => state.authUser?.id);
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    if (!orderId || !authToken || !userId) return;
    let cancelled = false;
    const marker = `brewlite-paid-cart:${orderId}`;
    async function clearPaidCart() {
      try {
        // Không xóa giỏ mới khi tải lại trang của đơn đã xử lý.
        if (sessionStorage.getItem(marker)) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const order = await res.json();
        if (cancelled || order.id !== orderId || order.userId !== userId ||
            !order.payments?.some((payment: { status: string }) => payment.status === 'SUCCESS')) return;
        sessionStorage.setItem(marker, '1');
        clearCart();
      } catch (error) {
        console.warn('Không thể xác nhận thanh toán để dọn giỏ hàng:', error);
      }
    }
    void clearPaidCart();
    return () => { cancelled = true; };
  }, [orderId, authToken, userId, clearCart]);

  return <OrderDetailsContent orderId={orderId} />;
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#55695c]">Đang tải đơn hàng...</div>}>
      <OrderSuccessInner />
    </Suspense>
  );
}
