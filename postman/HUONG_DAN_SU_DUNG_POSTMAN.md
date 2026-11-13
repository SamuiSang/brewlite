# HƯỚNG DẪN TEST TOÀN BỘ API BREWLITE TRÊN POSTMAN

Tài liệu này hướng dẫn chi tiết cách thiết lập môi trường, chạy thử toàn bộ chu trình đặt hàng - thanh toán - chuyển trạng thái - hủy đơn, và danh sách toàn bộ các API đã được việt hóa 100%.

---

## 1. HƯỚNG DẪN IMPORT VÀ SETUP TRONG POSTMAN

### Bước 1: Import Collection và Environment vào Postman
Trong Postman, nhấn nút **Import** (góc trên bên trái) và chọn 2 file sau trong thư mục `postman/`:
1. `postman/BrewLite_API_Collection.json` (Chứa toàn bộ hơn 40 API chuẩn, phân nhóm rõ ràng).
2. `postman/BrewLite_Local_Environment.json` (Chứa biến môi trường `baseUrl`, token của Admin/Barista/Customer, và `currentOrderId`).

### Bước 2: Chọn Environment (BẮT BUỘC)
- Ở góc trên bên phải màn hình Postman, click vào ô chọn Environment (thay vì để `No Environment` hay `New Environment`).
- Chọn môi trường: **`BrewLite Local`**.
> **Lưu ý nguyên nhân lỗi trước đây**:
> 1. Lỗi `ECONNREFUSED 127.0.0.1:3001`: Do Backend NestJS chưa được khởi động. Hãy đảm bảo terminal đang chạy backend trên port 3001.
> 2. Lỗi `404 Not Found (Cannot PATCH /orders//status)`: Do biến `currentOrderId` chưa có giá trị (bị rỗng `//`). Khi chọn đúng `BrewLite Local` và chạy request **"02. Tạo đơn hàng mới"**, biến `currentOrderId` sẽ được tự động điền giá trị.
> 3. Lỗi `401 Unauthorized`: Do chưa đăng nhập. Bạn chỉ cần chạy request **"Đăng nhập Khách hàng"** trong thư mục `01. Auth & Users` là token sẽ tự động được lưu.

---

## 2. TRÌNH TỰ MUA HÀNG VÀ CHUYỂN TRẠNG THÁI (ORDER STATE MACHINE)

Trình tự hoạt động chuẩn xác theo nghiệp vụ quán cà phê BrewLite:

```
[Khởi tạo đơn hàng]
       ↓
  1. PENDING (Chờ thanh toán)
       ↓
       ├─────────────────────────────────────────┐
       ↓                                         ↓
  2. PAID (Đã thanh toán)                 3. PAYMENT_FAILED (Thanh toán lỗi / Hủy TT)
  (Trừ tồn kho BOM + Tích điểm)                  ↓
       ↓                                  (Có thể thanh toán lại -> PAID)
       ├─────────────────────────────────────────┤
       ↓                                         ↓
[Chưa làm: Cho phép HỦY ĐƠN]             [Chưa làm: Cho phép HỦY ĐƠN]
  -> CANCELLED                             -> CANCELLED
  (Tự động hoàn kho BOM & hoàn điểm)       (Tự động hoàn kho BOM & hoàn điểm)
       ↓
  4. PREPARING (Đang làm đơn / Pha chế)
  [ĐÃ LÀM: KHÔNG CHO PHÉP HỦY ĐƠN NỮA]
       ↓
  5. READY (Đã làm xong đơn / Sẵn sàng lấy)
       ↓
  6. COMPLETED (Khách tới lấy và hoàn thành)
```

### Các bước test thực tế trong Postman:

1. **Bước 1 - Đăng nhập**:
   - Mở thư mục `01. Auth & Users` -> Chạy **"Đăng nhập Khách hàng"**.
   - Token sẽ tự động được lưu vào `tokenCustomer`.
2. **Bước 2 - Tạo đơn hàng**:
   - Mở thư mục `05. Orders` -> Chạy **"02. Tạo đơn hàng mới (Chờ thanh toán: PENDING)"**.
   - Đơn hàng mới được tạo ở trạng thái `PENDING`.
   - Postman tự động lưu mã UUID của đơn vào biến `{{currentOrderId}}`.
3. **Bước 3 - Thanh toán**:
   - **Nếu thanh toán thành công**: Chạy **"04. Chuyển trạng thái: Đã thanh toán (PAID)"**. Hệ thống tự động chạy Pessimistic Lock trừ kho nguyên liệu thô theo định mức BOM và tích điểm loyalty cho khách.
   - **Nếu khách hủy thanh toán / thẻ lỗi**: Chạy **"05. Chuyển trạng thái: Thanh toán lỗi / Hủy thanh toán (PAYMENT_FAILED)"**.
4. **Bước 4 - HỦY ĐƠN HÀNG NẾU CHƯA LÀM (Cancel Order)**:
   - Khi đơn ở `PENDING`, `PAYMENT_FAILED`, hoặc `PAID` (chưa bắt đầu pha chế):
     - Chạy **"09. HỦY ĐƠN HÀNG nếu chưa làm (POST /orders/:id/cancel)"**.
     - Đơn chuyển sang `CANCELLED`.
     - Hệ thống **tự động hoàn trả tồn kho nguyên liệu BOM (Restock)** và **hoàn lại điểm loyalty đã dùng**!
   - Nếu đơn đã chuyển sang `PREPARING`, `READY`, hoặc `COMPLETED`:
     - Gọi API Cancel sẽ bị chặn và trả về lỗi `400 Bad Request: "Đơn hàng đang ở trạng thái ... (đã đưa vào pha chế hoặc sẵn sàng nhận), không thể hủy đơn hàng."`
5. **Bước 5 - Pha chế & Hoàn thành**:
   - Chạy **"06. Chuyển trạng thái: Bắt đầu làm đơn (PAID -> PREPARING)"**.
   - Chạy **"07. Chuyển trạng thái: Đã làm xong đơn (PREPARING -> READY)"**.
   - Chạy **"08. Chuyển trạng thái: Khách tới lấy và hoàn thành (READY -> COMPLETED)"**.

---

## 3. DANH SÁCH TOÀN BỘ 34 API ĐÃ ĐƯỢC CẬP NHẬT TRONG POSTMAN

### Nhóm 01: Xác thực & Người dùng (Auth & Users)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `POST` | `{{baseUrl}}/auth/login` | Đăng nhập Khách hàng (Lưu `tokenCustomer`) |
| `POST` | `{{baseUrl}}/auth/login` | Đăng nhập Barista (Lưu `tokenBarista`) |
| `POST` | `{{baseUrl}}/auth/login` | Đăng nhập Admin (Lưu `tokenAdmin`) |
| `POST` | `{{baseUrl}}/auth/register` | Đăng ký tài khoản khách hàng mới |
| `GET` | `{{baseUrl}}/auth/profile` | Lấy thông tin tài khoản hiện tại |
| `PUT` | `{{baseUrl}}/auth/profile` | Cập nhật hồ sơ cá nhân |

### Nhóm 02: Menu & Sản phẩm (Menu & Products - Public)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/products` | Lấy danh sách toàn bộ món đồ uống kèm giá & tồn kho |
| `GET` | `{{baseUrl}}/products/:id` | Lấy chi tiết 1 sản phẩm |
| `GET` | `{{baseUrl}}/products/categories` | Lấy danh mục đồ uống (Cà phê Việt, Trà, Đá xay...) |
| `GET` | `{{baseUrl}}/products/toppings` | Lấy danh sách topping kèm giá & tồn kho |
| `GET` | `{{baseUrl}}/products?category=...&search=...` | Tìm kiếm và lọc sản phẩm theo từ khóa |

### Nhóm 03: Giỏ hàng (Cart)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/cart` | Lấy danh sách món trong giỏ hàng hiện tại |
| `PUT` | `{{baseUrl}}/cart` | Lưu / đồng bộ giỏ hàng |
| `DELETE` | `{{baseUrl}}/cart` | Xóa sạch giỏ hàng |

### Nhóm 04: Quản lý kho & Định lượng BOM (Inventory & BOM)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/inventory/ingredients` | Danh sách 17 nguyên liệu kho & mức tồn an toàn |
| `POST` | `{{baseUrl}}/inventory/validate-cart` | Kiểm tra giỏ hàng với BOM tồn kho nguyên liệu |
| `GET` | `{{baseUrl}}/inventory/availability/:productId?size=M` | Tính số ly tối đa có thể pha dựa trên tồn kho thực tế |
| `GET` | `{{baseUrl}}/inventory/recipes` | Tổng quan công thức tất cả sản phẩm & giá vốn COGS |
| `GET` | `{{baseUrl}}/inventory/recipes/:productId` | Chi tiết công thức định lượng (BOM) của 1 sản phẩm |
| `GET` | `{{baseUrl}}/inventory/transactions?limit=20` | Lịch sử giao dịch kho (Audit Log) |
| `POST` | `{{baseUrl}}/inventory/receipts` | Nhập kho nguyên liệu (Hỗ trợ quy đổi đơn vị kg->g, l->ml) |
| `PATCH` | `{{baseUrl}}/inventory/ingredients/:id/adjust` | Điều chỉnh tồn kho thủ công (Kiểm kê / Hao hụt) |

### Nhóm 05: Đơn hàng & State Machine (Orders & State Machine)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `POST` | `{{baseUrl}}/orders/validate-voucher` | 01. Kiểm tra mã voucher và tính số tiền giảm |
| `POST` | `{{baseUrl}}/orders` | 02. Tạo đơn hàng mới (`PENDING`) [Tự động lưu `currentOrderId`] |
| `GET` | `{{baseUrl}}/orders/{{currentOrderId}}/allowed-transitions` | 03. Xem các trạng thái tiếp theo hợp lệ theo State Machine |
| `PATCH` | `{{baseUrl}}/orders/{{currentOrderId}}/status` | 04. Chuyển trạng thái: `PAID` (Trừ kho BOM + Tích điểm) |
| `PATCH` | `{{baseUrl}}/orders/{{currentOrderId}}/status` | 05. Chuyển trạng thái: `PAYMENT_FAILED` (Thanh toán lỗi/Hủy TT) |
| `PATCH` | `{{baseUrl}}/orders/{{currentOrderId}}/status` | 06. Chuyển trạng thái: `PREPARING` (Bắt đầu pha chế) |
| `PATCH` | `{{baseUrl}}/orders/{{currentOrderId}}/status` | 07. Chuyển trạng thái: `READY` (Làm xong - Sẵn sàng lấy) |
| `PATCH` | `{{baseUrl}}/orders/{{currentOrderId}}/status` | 08. Chuyển trạng thái: `COMPLETED` (Khách lấy & hoàn thành) |
| `POST` | `{{baseUrl}}/orders/{{currentOrderId}}/cancel` | 09. **HỦY ĐƠN HÀNG nếu chưa làm (POST)** [Hoàn kho & hoàn điểm] |
| `PATCH` | `{{baseUrl}}/orders/{{currentOrderId}}/cancel` | 10. **HỦY ĐƠN HÀNG nếu chưa làm (PATCH)** |
| `GET` | `{{baseUrl}}/orders/me` | 11. Lịch sử đơn hàng của tôi (Khách hàng) |
| `GET` | `{{baseUrl}}/orders?status=PENDING` | 12. Danh sách đơn hàng toàn hệ thống (Barista/Admin xem) |
| `GET` | `{{baseUrl}}/orders/code/:orderCode` | 13. Tra cứu đơn hàng theo mã (VD: #1042 hoặc 1042) |
| `GET` | `{{baseUrl}}/orders/{{currentOrderId}}` | 14. Lấy chi tiết đơn hàng theo ID (Kiểm tra quyền truy cập) |

### Nhóm 06: Quản lý Voucher & Khuyến mãi (Vouchers & Promotions)
| Method | Endpoint | Quyền | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/vouchers` | Admin / Barista | 01. Lấy danh sách tất cả voucher (hỗ trợ lọc `?isActive=true&search=...`) |
| `GET` | `{{baseUrl}}/vouchers/:code` | Admin / Barista | 02. Lấy thông tin chi tiết 1 voucher theo mã code (VD: `GIAM20K`) |
| `POST` | `{{baseUrl}}/vouchers/validate` | Public | 03. Kiểm tra tính hợp lệ & tính số tiền được giảm (`code`, `orderAmount`) |
| `POST` | `{{baseUrl}}/vouchers` | Admin | 04. Tạo voucher khuyến mãi mới (`code`, `discountType`, `discountValue`, `minOrderAmount`, ...) |
| `PATCH` | `{{baseUrl}}/vouchers/:code` | Admin | 05. Cập nhật từng phần thông tin voucher (giá trị giảm, mức trần, ngày hết hạn, bật/tắt) |
| `PUT` | `{{baseUrl}}/vouchers/:code` | Admin | 06. Cập nhật toàn bộ thông tin voucher |
| `DELETE` | `{{baseUrl}}/vouchers/:code` | Admin | 07. Xóa voucher (tự động chuyển sang `isActive: false` nếu đã có đơn dùng để bảo toàn dữ liệu) |

> *Ghi chú*: Cả hai đường dẫn `/vouchers` và `/promotions` đều được hỗ trợ song song 100%.

### Nhóm 07: Cổng thanh toán VNPAY Sandbox (Payments & VNPAY)
| Method | Endpoint | Mô tả chức năng |
| :--- | :--- | :--- |
| `GET` | `{{baseUrl}}/payments/vnpay/config` | Lấy cấu hình test & số thẻ VNPAY Sandbox chính thức |
| `POST` | `{{baseUrl}}/payments/vnpay/create-url` | Tạo URL thanh toán VNPAY Sandbox thật (chuyển hướng người dùng sang cổng thanh toán ngân hàng VNPAY) |

*(Đã loại bỏ toàn bộ các API MoMo mock, QR code tĩnh giả lập và webhook giả lập theo yêu cầu)*

### Nhóm 08: Kịch bản kiểm thử lỗi & Edge Cases (Dành cho Giảng viên / QA)
| STT | Kịch bản kiểm thử | Mã lỗi mong đợi |
| :--- | :--- | :--- |
| 1 | Gọi API cần đăng nhập mà không truyền Token | `401 Unauthorized` |
| 2 | Body request thiếu trường bắt buộc hoặc sai định dạng | `400 Bad Request` |
| 3 | Đặt 9999 ly vượt quá tồn kho nguyên liệu BOM | `400 Bad Request (Báo rõ thiếu bao nhiêu)` |
| 4 | Nhập mã voucher khi đơn chưa đủ điều kiện tối thiểu | `400 Bad Request` |
| 5 | Nhảy cóc trạng thái bất hợp lệ (`PENDING` -> `COMPLETED`) | `400 Bad Request (Chặn bởi State Machine)` |
| 6 | Khách hàng cố tình xem đơn hàng của người khác (IDOR) | `403 Forbidden` |
| 7 | Thanh toán lặp lại với cùng `Idempotency-Key` | `409 Conflict / Cached Response` |
| 8 | **Chặn hủy đơn hàng khi đơn đã đưa vào pha chế (`PREPARING`)** | `400 Bad Request (Đơn đang làm, không thể hủy)` |
| 9 | **Chặn khách hàng hủy đơn của người khác (IDOR protection)** | `403 Forbidden` |
| 10 | **Chặn hủy đơn hàng 2 lần (Đơn đã `CANCELLED` trước đó)** | `400 Bad Request` |
| 11 | **Tạo Voucher bị trùng mã code đã tồn tại** | `409 Conflict (Mã voucher đã tồn tại)` |
| 12 | **Tạo Voucher loại PERCENTAGE với giá trị không hợp lệ (> 100% hoặc < 1%)** | `400 Bad Request` |
