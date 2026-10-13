import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#e5ded4] bg-[#f8f5ee] py-4 text-[11px] text-[#718076]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>Tiến hành ngay khi đặt món · Nhận 1 điểm cho mỗi ₫10.000 chi tiêu</p>
        <p className="flex items-center gap-1.5 font-medium text-[#5a6a60]">
          <span>Thanh toán an toàn</span>
          <span>·</span>
          <span>Nhận hàng tiện lợi</span>
        </p>
      </div>
    </footer>
  );
}
