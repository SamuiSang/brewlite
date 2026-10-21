import { Suspense, use } from 'react';
import { DRINKS } from '@/lib/data';
import CustomizeContent from './CustomizeContent';

export function generateStaticParams() {
  return DRINKS.map((d) => ({ id: d.id }));
}

function CustomizeInner({ params }: { params: Promise<{ id: string }> }) {
  const resolved = use(params);
  return <CustomizeContent drinkId={resolved.id} />;
}

export default function CustomizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 py-16 text-center text-sm text-[#708076]">
          Đang tải thông tin tùy chỉnh đồ uống...
        </div>
      }
    >
      <CustomizeInner params={params} />
    </Suspense>
  );
}
