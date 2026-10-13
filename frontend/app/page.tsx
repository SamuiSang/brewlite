import React, { Suspense } from 'react';
import MenuContent from './MenuContent';

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 py-16 text-center text-sm text-[#708076]">
          Đang tải menu Brewlite...
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
