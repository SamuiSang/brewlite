import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Coffee, Heart, Sparkles } from 'lucide-react';

export default function StoryPage() {
  return (
    <div className="flex-1 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Đường dẫn */}
        <div className="text-xs text-[#738478] mb-4 flex items-center gap-2">
          <Link href="/" className="hover:text-[#163d2c]">
            Menu
          </Link>
          <span>/</span>
          <span className="text-[#163d2c] font-semibold">
            Brewlite story
          </span>
        </div>

        {/* Tiêu đề */}
        <div className="mb-12 max-w-2xl">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#d6955b] block mb-2">
            Câu chuyện đằng sau mỗi ly cà phê
          </span>

          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-[#14241b] tracking-tight leading-tight mb-4">
            Cà phê ngon, thong thả tận hưởng.
          </h1>

          <p className="text-sm sm:text-base text-[#66776c] leading-relaxed">
            Giữa nhịp sống bận rộn, Brewlite ra đời với một suy nghĩ giản dị:
            Cà phê không chỉ giúp bạn tỉnh táo, mà còn là khoảng thời gian
            để chậm lại và tận hưởng từng khoảnh khắc trong ngày.
          </p>
        </div>

        {/* Câu chuyện thương hiệu */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mb-16">
          <div className="md:col-span-7 bg-[#163d2c] text-white rounded-3xl p-8 sm:p-10 border border-[#234d39] shadow-sm flex flex-col justify-between min-h-[380px]">
            <div>
              <span className="text-xs font-semibold text-[#d6955b] tracking-wide uppercase block mb-3">
                NGUỒN GỐC VÀ CHẤT LƯỢNG
              </span>

              <h2 className="font-serif text-3xl font-bold text-white mb-4">
                Từ cao nguyên đến tách cà phê của bạn.
              </h2>

              <p className="text-xs sm:text-sm text-[#c2d1c7] leading-relaxed mb-6">
                Chúng tôi hợp tác trực tiếp với các nông trại gia đình tại
                Đà Lạt và Lâm Đồng, tuyển chọn những hạt Arabica được trồng
                dưới bóng cây cùng các giống cà phê truyền thống, thu hoạch
                khi đạt độ chín thích hợp.
              </p>
            </div>

            <div className="pt-6 border-t border-[#234d39] grid grid-cols-3 gap-4 text-center">
              <div>
                <span className="font-serif text-2xl font-bold text-white block">
                  100%
                </span>
                <span className="text-[10px] text-[#8ca094]">
                  Cà phê đơn vùng
                </span>
              </div>

              <div>
                <span className="font-serif text-2xl font-bold text-[#d6955b] block">
                  16h
                </span>
                <span className="text-[10px] text-[#8ca094]">
                  Ủ lạnh chậm
                </span>
              </div>

              <div>
                <span className="font-serif text-2xl font-bold text-white block">
                  0
                </span>
                <span className="text-[10px] text-[#8ca094]">
                  Chất phụ gia
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 relative aspect-square rounded-3xl overflow-hidden border border-[#e8e2d7] shadow-sm">
            <Image
              src="/images/hero-drink.png"
              alt="Cà phê thủ công Brewlite"
              fill
              className="object-cover"
            />
          </div>
        </div>

        {/* Ba giá trị cốt lõi */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d7] shadow-xs flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#e3ede1] text-[#163d2c] flex items-center justify-center">
              <Coffee className="w-5 h-5 stroke-[2]" />
            </div>

            <h3 className="font-serif text-lg font-bold text-[#14241b]">
              Rang cà phê theo từng mẻ nhỏ
            </h3>

            <p className="text-xs text-[#6e8074] leading-relaxed">
              Cà phê được rang mới mỗi tuần tại Quận 3, giữ trọn hương thơm
  và vị caramel dịu nhẹ đặc trưng.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d7] shadow-xs flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#f5e6d6] text-[#9e5d26] flex items-center justify-center">
              <Heart className="w-5 h-5 stroke-[2]" />
            </div>

            <h3 className="font-serif text-lg font-bold text-[#14241b]">
              Sữa thực vật nguyên chất
            </h3>

            <p className="text-xs text-[#6e8074] leading-relaxed">
              Sữa yến mạch và sữa hạnh nhân được chuẩn bị không thêm chất
              bảo quản, mang đến vị ngọt dịu nhẹ hài hòa với cà phê espresso.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d7] shadow-xs flex flex-col gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#e3ede1] text-[#163d2c] flex items-center justify-center">
              <Sparkles className="w-5 h-5 stroke-[2]" />
            </div>

            <h3 className="font-serif text-lg font-bold text-[#14241b]">
              Nhận cà phê tại quầy
            </h3>

            <p className="text-xs text-[#6e8074] leading-relaxed">
              Bạn có thể đến quầy nhận đồ uống trực tiếp, thưởng thức cà phê
              khi vừa pha xong và vẫn giữ được hương vị thơm ngon nhất.
            </p>
          </div>
        </div>

        {/* Lời mời khám phá thực đơn */}
        <div className="bg-[#e4ede3] border border-[#d2ded1] rounded-3xl p-8 text-center flex flex-col items-center">
          <h3 className="font-serif text-2xl font-bold text-[#163d2c] mb-2">
            Chọn một ly cà phê bạn yêu thích.
          </h3>

          <p className="text-xs sm:text-sm text-[#55695c] max-w-md mb-6">
            Khám phá thực đơn với cà phê espresso, cold brew mát lạnh
            và matcha theo mùa.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#163d2c] hover:bg-[#102f21] text-white text-xs font-bold py-3 px-6 rounded-2xl shadow-sm transition-all"
          >
            <span>Khám phá thực đơn</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
