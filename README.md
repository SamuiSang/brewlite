# BrewLite ☕🍹

> **Hệ thống đặt đồ uống trực tuyến không dùng tiền mặt (Cashless Beverage Ordering System)**  
> Đồ án môn học: **Công nghệ Phần mềm (Software Engineering)** — Khoa Công nghệ Thông tin, Trường Đại học Sài Gòn.

---

## 📖 Giới thiệu tổng quan

**BrewLite** là ứng dụng web đặt đồ uống trực tuyến áp dụng mô hình *Order & Pick-up* (đặt trước lấy tại quầy). Hệ thống giúp khách hàng thoải mái xem thực đơn, tùy biến đồ uống (size, topping), áp mã giảm giá và thanh toán không dùng tiền mặt trước khi đến quán, giúp loại bỏ hoàn toàn việc phải xếp hàng chờ đợi trong giờ cao điểm.

---

## 👥 Thành viên nhóm phát triển

| STT | Thành viên | Vai trò | Phụ trách chính |
| :-: | :--- | :--- | :--- |
| 1 | **Nguyễn Thanh Sang** | Nhóm trưởng / Fullstack | Khởi tạo kiến trúc monorepo, Docker PostgreSQL, Prisma ORM, API/UI Lịch sử đơn hàng, đóng gói Docker Compose bàn giao. |
| 2 | **Hiếu** | Fullstack | API Đăng ký / Đăng nhập (JWT, Bcrypt, Auth Guard), Mock Payment API & UI Thanh toán không tiền mặt. |
| 3 | **Chiến** | Backend Developer | API Danh mục đồ uống, API Chi tiết sản phẩm, API Tạo đơn hàng PENDING và validate dữ liệu. |
| 4 | **Quang** | Backend Developer | Core Logic nâng cao: Máy trạng thái (Order State Machine), Chống trừ tiền 2 lần (Idempotency), Khóa tồn kho đồng thời (Optimistic Lock) và bộ kiểm thử tự động (Unit Tests). |
| 5 | **Duy** | Frontend Developer | Giao diện Thực đơn (Menu), bộ lọc danh mục đồ uống, tìm kiếm món, màn hình Chi tiết sản phẩm & tùy biến topping/size. |
| 6 | **Quỳnh** | Frontend Developer | Giao diện Giỏ hàng (Cart), quản lý State toàn cục bằng Zustand persist, tính toán tổng tiền và áp mã voucher. |

---

## 🛠 Công nghệ sử dụng (Tech Stack)

* **Frontend:** Next.js 16 (App Router), React 19, TypeScript, TailwindCSS v4, Zustand.
* **Backend:** NestJS 12, TypeScript, Passport JWT, Bcrypt, Class-Validator.
* **Cơ sở dữ liệu & ORM:** PostgreSQL 15, Prisma ORM 6.
* **DevOps & Đóng gói:** Docker, Docker Compose.
* **Kiểm thử (Testing):** Jest, ts-jest (34 bài kiểm thử tự động Unit/Integration Tests).

---

## ✨ Tính năng nổi bật

* 🍵 **Khám phá thực đơn:** Tìm kiếm nhanh, lọc theo danh mục (Cà phê, Trà trái cây, Trà sữa, Freeze/Đá xay).
* 🧋 **Tùy biến món (Customization):** Tùy chọn Size (S/M/L), thêm các loại Topping (Trân châu, Kem Cheese, Thạch...), tính giá tự động theo thời gian thực.
* 🛒 **Giỏ hàng thông minh:** Quản lý bằng Zustand persist, lưu giỏ hàng khi tải lại trang, hiển thị badge số lượng, hỗ trợ áp mã voucher giảm giá (`BREWLITE10`).
* 🔐 **Bảo mật & Xác thực:** Đăng ký / Đăng nhập băm mật khẩu chuẩn Bcrypt, cấp phát JSON Web Token (JWT) và bảo vệ route bằng Guard.
* 💳 **Thanh toán không tiền mặt:** Giả lập cổng thanh toán qua Ví điện tử / Thẻ ngân hàng, xử lý đổi trạng thái sang `PAID` và tích lũy điểm thưởng thành viên (`loyaltyPoints`).
* 📋 **Theo dõi & Lịch sử đơn hàng:** Màn hình hiển thị mã nhận nước tại quầy (ví dụ: `#1042`), tra cứu chi tiết đơn hàng và xem lịch sử các đơn đã đặt qua API `GET /orders/me`.
* 🛡️ **Nghiệp vụ lõi vững chắc (Core Engine):**
  * **Order State Machine:** Kiểm soát luồng trạng thái (`PENDING` → `PAID` → `PREPARING` → `READY` → `COMPLETED`), chặn các chuyển đổi trạng thái không hợp lệ.
  * **Thanh toán Idempotent:** Sử dụng `Idempotency-Key` bảo đảm một giao dịch không bao giờ bị trừ tiền hoặc tạo đơn 2 lần khi mạng lag.
  * **Khóa tồn kho (Optimistic Locking):** Dùng trường `version` kết hợp Database Transaction ngăn chặn tuyệt đối tình trạng bán vượt quá số lượng tồn kho khi nhiều khách đặt cùng lúc.

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Yêu cầu môi trường
* Đã cài đặt **Node.js** (phiên bản 20 trở lên).
* Đã cài đặt **Docker Desktop** (và đang bật).
* Đã cài đặt **Git**.

---

### 2. Cách 1: Chạy trọn gói bằng Docker Compose (Khuyên dùng khi Demo / Bàn giao)

Chỉ cần đứng tại thư mục gốc của dự án (`brewlite`) và chạy đúng **1 câu lệnh duy nhất**:

```bash
docker compose up -d --build
```

Hệ thống sẽ tự động build và kích hoạt trọn gói cả 3 dịch vụ:
* 🌐 **Frontend Web App:** 👉 [http://localhost:3000](http://localhost:3000)
* ⚙️ **Backend REST API:** 👉 [http://localhost:3001](http://localhost:3001)
* 🗄️ **PostgreSQL Database:** Cổng `5432`

*Để dừng toàn bộ hệ thống:*
```bash
docker compose down
```

---

### 3. Cách 2: Chạy ở chế độ Phát triển (Development Mode)

#### 🔹 Bước 1: Khởi động CSDL PostgreSQL qua Docker
Tại thư mục gốc:
```bash
docker compose up -d postgres
```

#### 🔹 Bước 2: Khởi động Backend (NestJS)
Mở cửa sổ terminal thứ nhất:
```bash
cd backend

# Cài đặt thư viện
npm install --legacy-peer-deps

# Tạo file môi trường (nếu chưa có)
copy .env.example .env

# Đồng bộ CSDL và nạp dữ liệu mẫu thực đơn
npx prisma db push
npx prisma db seed

# Chạy backend ở chế độ watch
npm run start:dev
```
Backend sẽ khởi chạy tại: **http://localhost:3001**

#### 🔹 Bước 3: Khởi động Frontend (Next.js)
Mở cửa sổ terminal thứ hai:
```bash
cd frontend

# Cài đặt thư viện
npm install

# Chạy giao diện ở chế độ dev
npm run dev
```
Frontend sẽ khởi chạy tại: **http://localhost:3000**

---

## 🧪 Kiểm thử tự động (Automated Testing)

Toàn bộ nghiệp vụ quan trọng (State Machine, Idempotency, Khóa tồn kho, Voucher, Lịch sử đơn) đều có bài kiểm thử tự động chứng minh:

```bash
cd backend
npm test
```

> **Kết quả kiểm thử:** Toàn bộ **34 / 34 tests** đều đạt tiêu chuẩn (100% Pass).

---

## 📡 Danh sách API Endpoint chính

| Phương thức | Endpoint | Chức năng | Phân quyền |
| :-: | :--- | :--- | :---: |
| `GET` | `/products` | Lấy danh sách thực đơn đồ uống (hỗ trợ lọc category, search) | Công khai |
| `GET` | `/products/:id` | Lấy thông tin chi tiết một đồ uống | Công khai |
| `GET` | `/categories` | Lấy danh sách phân loại đồ uống | Công khai |
| `GET` | `/toppings` | Lấy danh sách các loại topping | Công khai |
| `POST` | `/auth/register` | Đăng ký tài khoản khách hàng mới | Công khai |
| `POST` | `/auth/login` | Đăng nhập tài khoản, nhận chuỗi JWT token | Công khai |
| `POST` | `/orders` | Tạo đơn hàng mới (trạng thái ban đầu `PENDING`) | Công khai / User |
| `GET` | `/orders/code/:orderCode` | Tra cứu đơn hàng theo mã đơn (ví dụ: `#1042`) | Công khai |
| `GET` | `/orders/me` | Lấy danh sách lịch sử đơn hàng của tài khoản đang đăng nhập | Yêu cầu JWT Token |
| `POST` | `/payments` | Giả lập thanh toán hóa đơn (Idempotent mock payment) | Công khai / User |
| `PATCH` | `/orders/:id/status` | Cập nhật trạng thái đơn theo máy trạng thái | Admin / Barista |

---

## 📂 Cấu trúc thư mục dự án

```text
brewlite/
├── backend/                  # Mã nguồn Backend (NestJS)
│   ├── prisma/               # Cấu hình CSDL, Schema ERD & Seed Data
│   ├── src/
│   │   ├── auth/             # Module Xác thực JWT & Bcrypt
│   │   ├── orders/           # Module Đơn hàng, State Machine & Optimistic Lock
│   │   ├── payments/         # Module Thanh toán Idempotent
│   │   ├── products/         # Module Quản lý thực đơn & danh mục
│   │   └── prisma/           # Prisma Client Service
│   └── Dockerfile            # Đóng gói Docker cho Backend
├── frontend/                 # Mã nguồn Frontend (Next.js)
│   ├── app/                  # App Router: Menu, Cart, Checkout, Orders, Auth...
│   ├── components/           # Components dùng chung (Navbar, Footer, CartBar...)
│   ├── lib/                  # Zustand Store, Data Types, API client
│   └── Dockerfile            # Đóng gói Docker cho Frontend
├── docker-compose.yml        # Cấu hình khởi chạy trọn gói cả 3 dịch vụ
└── README.md                 # Tài liệu hướng dẫn dự án
```
