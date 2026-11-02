'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import OrderDetailsContent from '../orders/[id]/OrderDetailsContent';

function OrderSuccessInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '1042';
  return <OrderDetailsContent orderId={orderId} />;
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-[#55695c]">Đang tải đơn hàng...</div>}>
      <OrderSuccessInner />
    </Suspense>
  );
}
