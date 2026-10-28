# Chạy BrewLite bằng Docker (local)

Cần Docker Desktop đang chạy, Docker Compose và các cổng 3000, 3001, 5432 trống. Windows cần WSL 2. Không cần cài Node.js hay PostgreSQL trên máy để chạy app.

## Lần đầu sau khi clone

Chạy tại thư mục chứa docker-compose.yml:

```sh
docker compose up -d --build --wait
# Chỉ nạp dữ liệu mẫu cho database phát triển lần đầu:
docker compose exec backend npx prisma db seed
```

- Giao diện: http://localhost:3000
- Backend: http://localhost:3001/products
- PostgreSQL: localhost:5432, database brewlite, user postgres, password 123.

Backend tự đồng bộ schema bằng `prisma db push` trước khi khởi động. Seed tạo 16 món, 24 nguyên liệu và công thức S/M/L; điểm thưởng đổi 1 điểm = 500đ, tích 1 điểm mỗi 10.000đ chi tiêu. Tài khoản trong seed dùng hash minh họa không đăng nhập được; đăng ký tài khoản mới trên giao diện.

Không tự seed mỗi lần bật vì seed còn cập nhật tài khoản, topping và dữ liệu mẫu. Không dùng seed này trên database production.

## Cập nhật code và chạy lại

```sh
docker compose up -d --build --wait
docker compose ps
docker compose logs --tail=100 backend frontend
```

Không cần seed lại khi chỉ đổi giao diện/logic. Schema thay đổi có khả năng mất dữ liệu sẽ bị Prisma chặn; không tự thêm `--accept-data-loss`.

## Dừng và giữ dữ liệu

```sh
docker compose stop
# Hoặc xóa container/network, vẫn giữ volume dữ liệu:
docker compose down
```

Không dùng `docker compose down -v` nếu cần giữ dữ liệu. Database nằm trong volume `postgres_data`, không nằm trong GitHub hay image ứng dụng. Máy khác clone repo nhận schema và seed, không nhận dữ liệu khách hàng trên máy hiện tại.

## Kiểm tra

```sh
curl http://localhost:3001/products
curl -I http://localhost:3000/rewards
```

Có Node.js và đã cài dependency backend thì có thể chạy kiểm tra luồng thật:

```sh
cd backend
node test/ordering.smoke.cjs
```

Test dùng backend/.env trỏ database local, tạo fixture riêng rồi dọn. Bao phủ đăng ký/đăng nhập, voucher, tồn nguyên liệu, điểm, thanh toán giả lập và hủy hoàn kho.

## Đẩy source lên GitHub

Đưa Dockerfile, .dockerignore, docker-compose.yml, package-lock.json, schema, seed và source vào commit. Không đưa `.env`, `node_modules`, `.next`, `dist`, `.claude/worktrees`, database volume hoặc file image `.tar` lên GitHub. Build image trực tiếp từ source bằng lệnh ở trên.

Cấu hình này chỉ dành local: cổng chỉ bind 127.0.0.1; mật khẩu DB/JWT là giá trị phát triển, thanh toán là mock. Chưa dùng để public Internet. Dependency còn cảnh báo bảo mật; cần rà soát/nâng cấp trước triển khai thật.
