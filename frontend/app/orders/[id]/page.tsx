import { Suspense } from 'react';
import { INITIAL_ORDERS } from '@/lib/data';
import OrderDetailsContent from './OrderDetailsContent';

export function generateStaticParams() {
  return INITIAL_ORDERS.map((o) => ({ id: o.id }));
}

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div className="flex-1 py-12 text-center text-sm text-[#708076]">Đang tải thông tin chi tiết đơn hàng...</div>}>
      <OrderDetailsContent orderId={resolvedParams.id} />
    </Suspense>
  );
}
