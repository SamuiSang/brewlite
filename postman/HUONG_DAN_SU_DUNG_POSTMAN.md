# HƯỚNG DẪN TEST TOÀN BỘ API BREWLITE TRÊN POSTMAN

Tài liệu này hướng dẫn cách thiết lập môi trường, chạy thử toàn bộ chu trình API qua **Collection Runner** (hoặc từng request lẻ) với đầy đủ **Pre-request Script** & **Test Script** (`pm.test(...)`) cho mọi endpoint.

---

## 1. IMPORT VÀ THIẾT LẬP TRONG POSTMAN

1. Mở Postman -> **Import** 2 file sau trong thư mục `postman/`:
   - `postman/BrewLite_API_Collection.json` (Full collection 9 nhóm, 80+ request kèm script tự động kiểm tra status, dữ liệu và lưu biến).
   - `postman/BrewLite_Local_Environment.json` (Biến môi trường `BrewLite Local`).
   - *(Hoặc mở trực tiếp thư mục `postman/` trong Postman Local View — toàn bộ file `.request.yaml` đã được đồng bộ 1:1 kèm `scripts`).*
2. Ở góc trên bên phải Postman, chọn Environment **`BrewLite Local`**.
3. Bạn có thể bấm **Run collection** ngay trên collection `BrewLite Coffee POS - Full API Collection` để chạy tự động từ đầu đến cuối (từ Health -> Auth -> Menu -> Cart 15 API -> Inventory -> Orders -> Vouchers -> Payments/VNPAY -> Error & Edge Cases).

---

## 2. DANH SÁCH TOÀN BỘ API ĐÃ ĐƯỢC CẬP NHẬT

### Nhóm 00: Health & System
| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/` | Kiểm tra tình trạng Backend |

### Nhóm 01: Auth & Users
| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `{{baseUrl}}/auth/register` | Đăng ký tài khoản mới (tự sinh email duy nhất trong pre-request) |
| `POST` | `{{baseUrl}}/auth/login` | Đăng nhập Khách hàng (`tokenCustomer`), Barista (`tokenBarista`), Admin (`tokenAdmin`) |
| `GET` | `{{baseUrl}}/auth/me` | Lấy thông tin tài khoản & điểm Loyalty |
| `PATCH` | `{{baseUrl}}/auth/me` | Cập nhật họ tên & số điện thoại |
| `POST` | `{{baseUrl}}/auth/test-order` | Kiểm tra JWT Guard |

### Nhóm 02: Menu & Sản Phẩm (Public)
| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/categories` | Danh mục đồ uống |
| `GET` | `{{baseUrl}}/toppings` | Danh sách topping & giá |
| `GET` | `{{baseUrl}}/products` | Danh sách toàn bộ món |
| `GET` | `{{baseUrl}}/products?categoryId=...&search=...` | Lọc theo danh mục và từ khóa |
| `GET` | `{{baseUrl}}/products/:id` | Chi tiết sản phẩm |

### Nhóm 03: Giỏ hàng Full (Cart - 15 API)
| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/cart` | Lấy giỏ hàng kèm giá theo size (`S/+0`, `M/+5k`, `L/+10k`), topping, voucher, loyalty & `summary` |
| `GET` | `{{baseUrl}}/cart/summary` | Tóm tắt chi phí giỏ hàng + kết quả kiểm tra BOM tồn kho + `canCheckout` |
| `POST` | `{{baseUrl}}/cart/items` | Thêm 1 món vào giỏ (tự gộp số lượng nếu trùng `productId + size + milk + note + toppings`) |
| `GET` | `{{baseUrl}}/cart/items/:itemId` | Chi tiết 1 món trong giỏ |
| `PATCH` | `{{baseUrl}}/cart/items/:itemId` | Cập nhật size, số lượng, sữa, ghi chú, topping của 1 món |
| `PATCH` | `{{baseUrl}}/cart/items/:itemId/quantity` | Tăng/giảm nhanh bằng `delta` hoặc đặt `quantity` (tự xóa nếu `<= 0`) |
| `DELETE` | `{{baseUrl}}/cart/items/:itemId` | Xóa 1 món cụ thể khỏi giỏ |
| `PUT` | `{{baseUrl}}/cart` | Đồng bộ / thay thế toàn bộ giỏ hàng |
| `POST` | `{{baseUrl}}/cart/merge` | Gộp giỏ hàng Guest vào giỏ hàng User sau khi đăng nhập |
| `POST` | `{{baseUrl}}/cart/validate` | Kiểm tra giỏ hàng hiện tại với tồn kho nguyên liệu (BOM) |
| `POST` | `{{baseUrl}}/cart/voucher` | Áp dụng mã voucher trực tiếp lên giỏ hàng |
| `DELETE` | `{{baseUrl}}/cart/voucher` | Gỡ mã voucher khỏi giỏ hàng |
| `PATCH` | `{{baseUrl}}/cart/loyalty` | Bật / tắt sử dụng điểm thưởng Loyalty cho giỏ hàng |
| `POST` | `{{baseUrl}}/cart/checkout` | Đặt hàng trực tiếp từ giỏ hàng trong DB & tự động xóa sạch giỏ |
| `DELETE` | `{{baseUrl}}/cart` | Xóa sạch toàn bộ giỏ hàng & reset voucher/loyalty |

### Nhóm 04: Inventory & BOM
| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/inventory/ingredients` | Danh sách nguyên liệu & mức tồn an toàn |
| `POST` | `{{baseUrl}}/inventory/validate-cart` | Kiểm tra tính khả dụng giỏ hàng theo BOM |
| `GET` | `{{baseUrl}}/inventory/availability/:productId?size=M` | Tính số ly tối đa có thể pha |
| `GET` | `{{baseUrl}}/inventory/recipes` | Tổng quan công thức & giá vốn COGS |
| `GET` | `{{baseUrl}}/inventory/recipes/:productId` | Chi tiết định lượng BOM 1 sản phẩm |
| `GET` | `{{baseUrl}}/inventory/transactions?limit=20` | Lịch sử biến động kho |
| `POST` | `{{baseUrl}}/inventory/ingredients` | Thêm nguyên liệu mới |
| `PATCH` | `{{baseUrl}}/inventory/ingredients/:id` | Cập nhật định mức / giá vốn nguyên liệu |
| `PATCH` | `{{baseUrl}}/inventory/ingredients/:id/adjust` | Điều chỉnh tồn kho thủ công (`quantityChange`, `reason`) |
| `POST` | `{{baseUrl}}/inventory/receipts` | Nhập kho kèm quy đổi đơn vị (`kg -> g`, `unitCost`) |
| `POST` | `{{baseUrl}}/inventory/recipes` | Cài đặt công thức BOM cho sản phẩm |
| `POST` | `{{baseUrl}}/inventory/recipes/:productId/copy-from/:sourceProductId` | Sao chép công thức giữa 2 sản phẩm |
| `DELETE` | `{{baseUrl}}/inventory/recipes/:productId/ingredient/:ingredientId` | Xóa 1 nguyên liệu khỏi công thức |

### Nhóm 05: Orders & State Machine
| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `{{baseUrl}}/orders/validate-voucher` | Kiểm tra mã voucher & tiền giảm |
| `POST` | `{{baseUrl}}/orders` | Tạo đơn hàng mới (`PENDING`) |
| `GET` | `{{baseUrl}}/orders/:id/allowed-transitions` | Xem trạng thái kế tiếp hợp lệ |
| `PATCH` | `{{baseUrl}}/orders/:id/status` | Chuyển trạng thái (`PAYMENT_FAILED`, `PAID`, `PREPARING`, `READY`, `COMPLETED`) |
| `POST` / `PATCH` | `{{baseUrl}}/orders/:id/cancel` | Hủy đơn khi chưa pha chế (`PENDING`, `PAYMENT_FAILED`, `PAID`) |
| `GET` | `{{baseUrl}}/orders/me` | Lịch sử đơn hàng của tôi |
| `GET` | `{{baseUrl}}/orders?status=...` | Danh sách đơn toàn hệ thống (Barista/Admin) |
| `GET` | `{{baseUrl}}/orders/code/:orderCode` | Tra cứu theo mã đơn |
| `GET` | `{{baseUrl}}/orders/:id` | Chi tiết đơn hàng (chống IDOR) |

### Nhóm 06: Vouchers & Khuyến mãi
- `GET /vouchers`, `GET /vouchers/:code`, `POST /vouchers/validate`, `POST /vouchers`, `PATCH /vouchers/:code`, `PUT /vouchers/:code`, `DELETE /vouchers/:code`, và alias `GET /promotions`.

### Nhóm 07: Payments & VNPAY Sandbox
- `GET /payments/vnpay/config`, `POST /payments` (2 bước + Idempotency-Key), `GET /payments/:paymentId/qr`, `POST /payments/webhook`, `POST /payments/vnpay/create-url`, `GET /payments/vnpay/ipn` (Pre-request tự ký `HMAC-SHA512`), `GET /payments/vnpay/return` (Pre-request tự ký `HMAC-SHA512`).

### Nhóm 08: Error & Edge Cases
- Bao gồm 17 kịch bản kiểm thử lỗi `401`, `400`, `403 IDOR`, `404`, `409` cho Auth, Cart, Orders, BOM, Vouchers và State Machine.
