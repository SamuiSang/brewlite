# BrewLite ☕🍹

Hệ thống đặt đồ uống trực tuyến - Đồ án môn Kỹ thuật Phần mềm (Software Engineering).

---

## 🛠 Tech Stack
* **Frontend:** Next.js (TypeScript, TailwindCSS) - Port `3000`
* **Backend:** NestJS (TypeScript) - Port `3001`
* **Database:** PostgreSQL 15 (chạy container qua Docker Compose) - Port `5432`
* **ORM:** Prisma ORM

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án (Dành cho thành viên)

### 1. Yêu cầu môi trường
* Đã cài đặt **Node.js** (khuyến nghị phiên bản 20 trở lên).
* Đã cài đặt **Docker Desktop** (và đang bật).
* Đã cài đặt **Git** / **GitHub Desktop**.

---

### 2. Khởi động CSDL PostgreSQL (Docker)
Mở terminal tại thư mục gốc của dự án (`brewlite`):
```bash
docker compose up -d
```
*(Lệnh này sẽ khởi động container CSDL `brewlite_db` chạy ngầm trên cổng 5432)*.

---

### 3. Khởi động Backend (NestJS)
Mở một cửa sổ terminal mới:
```bash
cd backend
npm install
```
Tạo file `.env` từ file mẫu (nếu chưa có):
* Trên Windows PowerShell: `Copy-Item .env.example .env`
* Hoặc copy file `.env.example` đổi tên thành `.env`.

Đồng bộ bảng CSDL qua Prisma:
```bash
npx prisma db push
```

Nạp dữ liệu mẫu đồ uống (Menu, Topping, Voucher):
```bash
npx prisma db seed
```

Chạy Backend ở chế độ phát triển:
```bash
npm run start:dev
```
Backend sẽ khởi chạy tại: 👉 **http://localhost:3001**

---

### 4. Khởi động Frontend (Next.js)
Mở thêm một cửa sổ terminal khác:
```bash
cd frontend
npm install
npm run dev
```
Frontend sẽ khởi chạy tại: 👉 **http://localhost:3000**

---

## 🌿 Quy Trình Làm Việc Với Git & GitHub

### 1. Quy tắc đặt tên nhánh
Mỗi thành viên khi làm task của mình **bắt buộc tạo một nhánh riêng**, không commit trực tiếp lên `main`:
```
feature/task-[số_task]-[tên_bạn]
```
*Ví dụ:*
* `feature/task-3-products-api-m3`
* `feature/task-1-menu-ui-m1`

### 2. Các bước làm việc hàng ngày
1. **Lấy code mới nhất:** Luôn về nhánh `main` bấm **Fetch / Pull** để cập nhật code mới nhất từ các bạn khác.
2. **Tạo nhánh:** Tạo nhánh mới từ `main` theo quy tắc đặt tên ở trên.
3. **Code & Commit:** Thực hiện code trên nhánh của mình và commit với nội dung rõ ràng.
4. **Push & Tạo Pull Request (PR):** Đẩy nhánh lên GitHub và bấm **Create Pull Request** vào nhánh `main`.
5. **Duyệt code:** Báo nhóm trưởng (**Sang**) review và bấm **Merge pull request**.

---

## 📋 Phân Công Công Việc Sprint 1 (Tuần 1)
* **Sang (M5):** Khởi tạo khung dự án Next.js, NestJS, Docker Compose PostgreSQL, cấu hình Prisma và quy chuẩn Git. *(Đã hoàn thành)*
* **Thành viên M3:** Hoàn thiện bảng `Product` trong `backend/prisma/schema.prisma`, viết API `GET /products` và seed data mẫu.
* **Thành viên M1:** Thiết kế giao diện Menu hiển thị danh sách món ăn/đồ uống và trang chi tiết món, gọi API `GET /products` từ Backend.
* **Thành viên M2, M4, M6:** Nghiên cứu Zustand, JWT và hoàn thiện thiết kế CSDL cho Sprint 2.
