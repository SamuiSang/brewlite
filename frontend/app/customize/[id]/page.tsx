import { Suspense } from 'react';
import { DRINKS } from '@/lib/data';
import CustomizeContent from './CustomizeContent';

export function generateStaticParams() {
  return DRINKS.map((d) => ({ id: d.id }));
}

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div className="flex-1 py-12 text-center text-sm text-[#708076]">Đang tải thông tin đồ uống...</div>}>
      <CustomizeContent drinkId={resolvedParams.id} />
    </Suspense>
  );
}
