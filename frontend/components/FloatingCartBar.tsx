'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { formatVND } from '@/lib/data';

export default function FloatingCartBar() {
  const [mounted, setMounted] = useState(false);
  const totalItems = useCartStore((state) => state.getTotalItems());
  const total = useCartStore((state) => state.getTotal());

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || totalItems === 0) {
    return null;
  }

  return (
    <div className="w-full my-8">
      <div className="bg-[#e2ebe0] border border-[#d2dfcf] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl border border-[#c1d3be] flex items-center justify-center text-[#163d2c] bg-[#eaf1e9] shrink-0">
            <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-[#163d2c]">
              {totalItems} {totalItems === 1 ? 'drink' : 'drinks'} in your cart
            </h4>
            <p className="text-xs text-[#55695c]">
              Xem lại đồ uống, sau đó thanh toán an toàn để nhận tại quầy.
            </p>
          </div>
        </div>

        <Link
          href="/cart"
          id="view-cart-banner-button"
          className="inline-flex items-center justify-center gap-2 bg-[#163d2c] hover:bg-[#112f22] text-[#f8f5ee] text-xs font-semibold px-5 py-3 rounded-xl transition-all shadow-sm active:scale-[0.98] w-full sm:w-auto text-center"
        >
          <span>
            View cart · {totalItems} {totalItems === 1 ? 'item' : 'items'} · {formatVND(total)}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
