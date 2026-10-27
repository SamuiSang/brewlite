# Hướng Dẫn Khởi Chạy Dự Án BrewLite ☕🍹

Tài liệu này dành cho thành viên mới sau khi **clone repository** về máy, giúp bạn thiết lập và khởi chạy trọn bộ hệ thống từ đầu (Database + Backend + Frontend) chỉ trong 5 phút.

---

## 📋 Mục Lục
1. [Yêu cầu môi trường](#1-yêu-cầu-môi-trường)
2. [Clone dự án về máy](#2-clone-dự-án-về-máy)
3. [Bước 1: Khởi động Database (Docker)](#3-bước-1-khởi-động-database-docker)
4. [Bước 2: Cấu hình và chạy Backend (NestJS)](#4-bước-2-cấu-hình-và-chạy-backend-nestjs)
5. [Bước 3: Cấu hình và chạy Frontend (Next.js)](#5-bước-3-cấu-hình-và-chạy-frontend-nextjs)
6. [Tài khoản & Dữ liệu kiểm thử có sẵn](#6-tài-khoản--dữ-liệu-kiểm-thử-có-sẵn)
7. [Luồng trải nghiệm đặt hàng trên Web](#7-luồng-trải-nghiệm-đặt-hàng-trên-web)
8. [Các lệnh kiểm thử & tiện ích (Tests)](#8-các-lệnh-kiểm-thử--tiện-ích-tests)
9. [Xử lý lỗi thường gặp (Troubleshooting)](#9-xử-lý-lỗi-thường-gặp-troubleshooting)

---

## 1. Yêu cầu môi trường

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:

- **Node.js**: Phiên bản `v20.x` trở lên ([Tải tại đây](https://nodejs.org/)). Kiểm tra bằng:
  ```bash
  node -v
  npm -v
  ```
- **Docker Desktop**: Cần cài đặt và **đang bật** ([Tải tại đây](https://www.docker.com/products/docker-desktop/)). Kiểm tra bằng:
  ```bash
  docker -v
  ```
- **Git**: Đã cài đặt để quản lý mã nguồn.

---

## 2. Clone dự án về máy

Nếu bạn chưa tải source code về máy, hãy mở terminal và chạy:

```bash
git clone https://github.com/SamuiSang/brewlite.git
cd brewlite
```

---

## 3. Bước 1: Khởi động Database (Docker)

Hệ thống sử dụng **PostgreSQL 15** chạy qua Docker Compose trên cổng `5432`.

1. Đảm bảo ứng dụng **Docker Desktop** đã được mở và biểu tượng cá voi hiển thị trạng thái đang chạy (running).
2. Tại thư mục gốc của dự án (`brewlite`), mở terminal và gõ:

```bash
docker compose up -d
```

3. Kiểm tra container đã chạy thành công chưa:
```bash
docker ps
```
> Khi thấy container tên **`brewlite_db`** hiển thị trạng thái `Up ... 0.0.0.0:5432->5432/tcp` là CSDL đã sẵn sàng!

---

## 4. Bước 2: Cấu hình và chạy Backend (NestJS)

Mở một cửa sổ Terminal mới (Terminal 1):

### 4.1. Di chuyển vào thư mục backend & cài đặt thư viện
```bash
cd backend
npm install
```

### 4.2. Thiết lập file cấu hình môi trường (.env)
Tạo file `.env` từ file mẫu `.env.example`:
- **Trên Windows PowerShell:**
  ```powershell
  Copy-Item .env.example .env
  ```
- **Trên Windows Command Prompt (CMD):**
  ```cmd
  copy .env.example .env
  ```
- **Trên macOS / Linux:**
  ```bash
  cp .env.example .env
  ```

*(File `.env` mặc định đã trỏ đúng kết nối PostgreSQL tới container Docker `brewlite_db` trên port 5432: `DATABASE_URL="postgresql://postgres:123@localhost:5432/brewlite?schema=public"`)*.

### 4.3. Đồng bộ cấu trúc bảng và nạp dữ liệu mẫu
Chạy lệnh đẩy cấu trúc bảng vào Database qua Prisma:
```bash
npx prisma db push
```

Tiếp tục nạp dữ liệu mẫu (Danh mục, 16 món đồ uống, 8 loại topping, voucher, tài khoản):
```bash
npx prisma db seed
```

### 4.4. Khởi động Backend
```bash
npm run start:dev
```

👉 **Backend chạy tại:** [http://localhost:3001](http://localhost:3001)  
Bạn có thể mở trình duyệt kiểm tra API: [http://localhost:3001/categories](http://localhost:3001/categories) để xem danh sách danh mục đồ uống.

---

## 5. Bước 3: Cấu hình và chạy Frontend (Next.js)

Mở thêm một cửa sổ Terminal khác (Terminal 2):

### 5.1. Di chuyển vào thư mục frontend & cài đặt thư viện
```bash
cd frontend
npm install
```

### 5.2. Thiết lập file cấu hình môi trường (.env.local)
Tạo file `.env.local` từ `.env.example`:
- **Trên Windows PowerShell:**
  ```powershell
  Copy-Item .env.example .env.local
  ```
- **Trên Windows Command Prompt (CMD):**
  ```cmd
  copy .env.example .env.local
  ```
- **Trên macOS / Linux:**
  ```bash
  cp .env.example .env.local
  ```

*(File `.env.local` chứa biến `NEXT_PUBLIC_API_URL="http://localhost:3001"` để kết nối với Backend).*

### 5.3. Khởi động Frontend
```bash
npm run dev
```

👉 **Frontend khởi chạy tại:** [http://localhost:3000](http://localhost:3000)

---

## 6. Tài khoản & Dữ liệu kiểm thử có sẵn

Hệ thống đã có sẵn tài khoản mẫu trong Database (từ lệnh `prisma db seed`) và hỗ trợ đăng ký tài khoản mới:

### 🔑 Tài khoản đăng nhập nhanh:
| Vai trò (Role) | Email | Mật khẩu | Điểm tích lũy |
| :--- | :--- | :--- | :--- |
| **Khách hàng (Customer)** | `duy.nguyen@example.com` | `Password123` | 50 điểm |
| **Quản trị viên (Admin)** | `admin@brewlite.vn` | `Password123` *(hoặc tự tạo)* | 1000 điểm |
| **Pha chế (Barista)** | `barista@brewlite.vn` | `Password123` *(hoặc tự tạo)* | 100 điểm |

> 💡 **Khuyên dùng:** Bạn có thể bấm vào trang **Đăng ký** (`/signup`) trên giao diện để tạo một tài khoản mới bất kỳ cho mình với email riêng!

### 🎟️ Mã Voucher giảm giá có thể dùng thử:
- `BREW5` hoặc `BREWS`: Giảm **5.000đ** trực tiếp cho đơn hàng.
- `BREWLITE10` hoặc `BREW10`: Giảm **10%** (tối đa 30.000đ).
- `WELCOME10`: Giảm **10%** cho đơn từ 40.000đ (tối đa 20.000đ).
- `GIAM20K`: Giảm **20.000đ** cho đơn từ 60.000đ.

---

## 7. Luồng trải nghiệm đặt hàng trên Web

1. **Khám phá menu:** Vào [http://localhost:3000](http://localhost:3000), xem danh sách các món đồ uống (Cà phê Việt Nam, Cà phê máy, Trà trái cây, Trà sữa, Đá xay...).
2. **Tùy chỉnh món:** Bấm vào một món bất kỳ để chọn Size (S / M / L), chọn sữa (Sữa tươi / Yến mạch), thêm Topping (Trân châu đen, Thạch nha đam, Kem cheese...) và bấm **Thêm vào giỏ**.
3. **Giỏ hàng:** Bấm vào biểu tượng giỏ hàng ở thanh điều hướng trên cùng để vào `/cart`. Nhập mã voucher để áp dụng giảm giá.
4. **Bắt buộc đăng nhập để mua hàng:**
   - Nếu bạn **chưa đăng nhập**: Giao diện giỏ hàng sẽ hiện thông báo *"Bạn chưa đăng nhập"* và nút chuyển thành **"Đăng nhập để thanh toán"**.
   - Bấm nút này sẽ đưa bạn sang trang Đăng nhập (`/signin?redirect=/checkout`).
   - Sau khi đăng nhập thành công, hệ thống **tự động quay trở lại trang Thanh toán (`/checkout`)** với giỏ hàng được giữ nguyên.
5. **Thanh toán:**
   - Chọn phương thức Thẻ ngân hàng hoặc Ví MoMo/VNPay.
   - Bấm **Thanh toán ngay**.
   - Đơn hàng được tạo với trạng thái `PENDING` -> `PAID`, tồn kho trừ an toàn bằng Optimistic Lock và tự động cộng điểm thưởng thành viên.
6. **Xem đơn hàng:** Vào mục **Đơn hàng** (`/orders`) trên thanh điều hướng để xem lịch sử và theo dõi trạng thái đơn hàng.

---

## 8. Các lệnh kiểm thử & tiện ích (Tests)

### Chạy trọn bộ Unit Test của Backend
Backend tích hợp sẵn 34 test cases kiểm thử Khóa tồn kho đồng thời (Optimistic Locking), Máy trạng thái đơn hàng (Order State Machine), Voucher, Loyalty và Idempotency:

```bash
cd backend
npm test
```

### Chạy kiểm tra định dạng code (Linting)
```bash
# Backend
cd backend
npm run lint

# Frontend
cd frontend
npm run lint
```

---

## 9. Xử lý lỗi thường gặp (Troubleshooting)

### ❓ Lỗi 1: `failed to connect to the docker API at npipe://...`
- **Nguyên nhân:** Docker Desktop chưa được mở hoặc engine chưa khởi động xong.
- **Cách khắc phục:** Mở ứng dụng **Docker Desktop** trên máy, chờ khoảng 10-15 giây đến khi icon Docker chuyển sang màu xanh lá cây rồi gõ lại `docker compose up -d`.

### ❓ Lỗi 2: Trùng cổng `5432` khi chạy Docker
- **Nguyên nhân:** Máy bạn đã cài sẵn dịch vụ PostgreSQL cục bộ chạy ngầm trên Windows/macOS chiếm cổng 5432.
- **Cách khắc phục trên Windows:** Mở `services.msc`, tìm service `postgresql...`, bấm **Stop**, sau đó chạy lại `docker compose up -d`.

### ❓ Lỗi 3: Prisma báo lỗi `Can't reach database server at localhost:5432`
- **Nguyên nhân:** Container Docker `brewlite_db` chưa kịp sẵn sàng khi chạy lệnh push.
- **Cách khắc phục:** Chờ khoảng 5 giây và chạy lại:
  ```bash
  npx prisma db push
  npx prisma db seed
  ```

### ❓ Lỗi 4: Muốn xóa toàn bộ dữ liệu CSDL để nạp lại từ đầu (Reset Database)
Tại thư mục gốc `brewlite`, chạy:
```bash
docker compose down -v
docker compose up -d
cd backend
npx prisma db push
npx prisma db seed
```

---

🎉 **Chúc bạn có trải nghiệm phát triển và vận hành mượt mà cùng BrewLite!**
