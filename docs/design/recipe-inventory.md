# Quản lý sản phẩm theo công thức nguyên liệu

## Quy tắc nghiệp vụ

Không dùng số ly cố định làm nguồn tồn kho. Với sản phẩm p, size s:

`Số ly tối đa(p, s) = min(floor(tồn nguyên liệu i / định lượng i cho một ly(p, s)))`

Ví dụ 100 g cà phê, mỗi ly S dùng 10 g: tối đa 10 ly. Đặt 11 ly cần 110 g, hệ thống báo thiếu. Nếu cà phê đủ nhưng sữa chỉ đủ 4 ly thì chỉ bán được 4 ly. Công thức thiếu hoặc định lượng không hợp lệ: không bán, không mặc định còn 100 ly.

Mỗi nguyên liệu có một đơn vị chuẩn (g, ml hoặc piece); tồn kho và định lượng phải cùng đơn vị. Dùng Decimal(14,3), không dùng số thực JavaScript để cộng/trừ nguyên liệu.

## Dữ liệu

- `ingredients`: tên, đơn vị chuẩn, lượng tồn thực tế và version chống ghi đè đồng thời.
- `recipe_ingredients`: khóa ghép sản phẩm, size, nguyên liệu; quantity là lượng cho một ly.
- `order_ingredients`: snapshot tổng lượng từng nguyên liệu đã giữ cho đơn. Không tính lại theo công thức hiện tại khi hủy.
- `products.stock` và `products.version`: cột cũ giữ lại để không xóa dữ liệu trong đợt chuyển đổi; logic mới không đọc/trừ chúng. API `stock` là số ly S tính toán, `stockBySize` là số ly từng size.

Seed có công thức minh họa cho 16 món và ba size. Size M/L dùng hệ số 1.25/1.5; mỗi ly dùng một vỏ ly đúng size. Công thức mẫu cần được người phụ trách pha chế xác nhận trước vận hành thực tế. Chạy lại seed không reset tồn nguyên liệu đã có.

## Đặt hàng và hủy

1. Backend đọc công thức đúng size, tính nhu cầu bằng định lượng nhân số ly.
2. Cộng nhu cầu của mọi dòng trong giỏ theo nguyên liệu. Hai món dùng chung cà phê không được kiểm tra riêng rồi bán vượt kho.
3. Kiểm tra lượng cần với tồn thực tế. Thông báo nêu nguyên liệu thiếu, lượng cần, lượng còn và đơn vị.
4. Trong cùng transaction, cập nhật có điều kiện version khớp và tồn đủ, trừ nguyên liệu, lưu đơn và snapshot. Lỗi bất kỳ làm rollback toàn bộ. Xung đột tồn kho được đọc lại và thử tối đa ba lần.
5. Hủy đơn hoàn đúng snapshot. Chuyển trạng thái có điều kiện trạng thái cũ, chặn hai yêu cầu hủy cùng hoàn kho.

Số ly trên menu là khả năng bán riêng từng món tại thời điểm tải, không phải cam kết tổng giỏ. Backend kiểm tra lại toàn giỏ khi đặt. Đơn cũ chưa có snapshot không tự hoàn nguyên liệu vì không có cơ sở biết công thức tại thời điểm đặt.

## Áp dụng database

Database Docker phát triển đã được tạo và nạp công thức mẫu. Với database khác, sao lưu trước khi áp dụng; không cần reset database. Đơn lưu `points_redeemed` để hoàn chính xác điểm đã dùng khi hủy; trừ điểm có điều kiện số dư đủ trong transaction.

Tại thư mục backend, với database đã có schema cũ:

```sh
npx prisma db execute --file prisma/recipe-inventory.sql --schema prisma/schema.prisma
npx prisma generate
```

SQL thêm ba bảng, khóa ngoại và CHECK chống tồn âm/định lượng không dương/size sai; toàn bộ nằm trong transaction. Chạy một lần. Dự án hiện chưa có lịch sử Prisma migrations; SQL này dùng cho database đang có, không phải migration khởi tạo database trống.

Với database phát triển, nạp dữ liệu mẫu:

```sh
npx prisma db seed
```

Seed hiện có còn cập nhật danh mục, sản phẩm, topping, khuyến mãi và tài khoản mẫu. Không chạy nguyên seed trên production; chỉ nhập nguyên liệu và công thức đã xác nhận, cùng lượng tồn được kiểm kê. Sau khi triển khai, khởi động lại backend trước khi kiểm tra frontend.

## Kiểm tra

```sh
cd backend
npm test -- --runInBand
npm run build
# Sau khi Docker app chạy; test tạo và dọn fixture riêng:
node test/ordering.smoke.cjs
cd ../frontend
npx tsc --noEmit
node lib/inventory.check.cjs
```

Test bao phủ 100 g/10 g, ly thứ 11, nguyên liệu giới hạn, số lẻ, size thiếu, cộng nguyên liệu chung, xung đột version và hoàn snapshot khi hủy.

## Giới hạn hiện tại

- Topping vẫn dùng mô hình tồn riêng hiện có; chưa chuyển topping thành công thức nguyên liệu. Không coi kiểm tra `isAvailable` là kiểm kê topping thực tế.
- Chưa có màn hình nhập kho/quản trị công thức; quản lý trực tiếp dữ liệu có kiểm soát. Khi thêm luồng này, thay đổi tồn phải tăng version và giữ cùng đơn vị chuẩn.
- Đơn PENDING giữ nguyên liệu ngay khi tạo. Chưa tự hết hạn giữ chỗ; cần hủy đơn bỏ dở để hoàn kho.
- Không tự hoàn nguyên liệu sau khi đã pha; luồng hiện tại chỉ cho hủy PENDING/PAID theo state machine có sẵn.
