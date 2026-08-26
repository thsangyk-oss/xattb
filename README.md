# Bệnh viện Đa khoa Xuyên Á — Quản lý thiết bị y tế

Webapp nội bộ quản lý hồ sơ thiết bị, báo hỏng qua QR, lịch bảo trì, quyền xem liên khoa và báo cáo tùy chọn cho 5 chi nhánh.

## Chạy trong mạng Tailscale

Yêu cầu Node.js 22 trở lên.

```powershell
npm install
npm run dev
```

Máy chủ lắng nghe trên `0.0.0.0:8792`. Truy cập từ máy chủ tại `http://localhost:8792`, hoặc từ thiết bị cùng mạng Tailscale tại:

```text
http://<TAILSCALE-IP-CUA-MAY-CHU>:8792
```

Đổi cổng bằng biến môi trường `PORT`, ví dụ `PORT=9000 npm start`.

## Chạy bản production

```powershell
npm run build
npm start
```

Dữ liệu tập trung lưu trong `data/store.json`; tài liệu tải lên lưu trong `uploads/`. Hai thư mục này cần được sao lưu định kỳ trên máy chủ.

## Phân quyền

Ba cấp tài khoản, phạm vi dữ liệu được **máy chủ cắt trước khi trả về** — người dùng không thể thấy dữ liệu ngoài phạm vi kể cả khi gọi API trực tiếp.

| Vai trò | Phạm vi xem | Quyền sửa |
| --- | --- | --- |
| **Admin tổng** (`admin`) | Toàn bộ 5 chi nhánh, chuyển chi nhánh trên thanh bên | Toàn quyền, quản lý mọi tài khoản |
| **Quản lý chi nhánh** (5 tài khoản) | Đúng chi nhánh được gán | Thiết bị, lịch, sự cố, khoa/phòng và tài khoản khoa của chi nhánh mình |
| **Tài khoản khoa** (1 tài khoản/khoa) | Thiết bị của khoa mình, cộng thiết bị khoa khác đã bật *Cho phép mượn* nếu được cấp quyền Xem | Chỉ báo hỏng và thêm ghi chú xử lý |

Quyền xem liên khoa bật/tắt ở **Đơn vị & phân quyền → Quyền xem & mượn** (theo từng khoa), kết hợp với công tắc *Cho phép mượn* trên từng hồ sơ thiết bị.

## Chức năng chính

- Phân cấp Công ty → Chi nhánh → Khoa/phòng → Phòng sử dụng, có thêm/sửa/xóa khoa phòng.
- Hồ sơ thiết bị: mã nội bộ, mã HIS, model, seri, hãng/nước/năm SX, ngày hợp đồng, bàn giao, **nghiệm thu**, đưa vào sử dụng, khoảng bảo hành, chu kỳ và mốc bảo trì.
- Tài liệu scan gắn theo thiết bị, **chọn loại tài liệu khi tải lên** (hợp đồng, nghiệm thu, hóa đơn, bảo hành, bảo trì, kiểm định).
- QR mở biểu mẫu báo hỏng tối ưu cho điện thoại, không cần đăng nhập, có chụp ảnh lỗi.
- Trung tâm cảnh báo tính từ dữ liệu thật: sự cố đang mở, hẹn xử lý trễ, lịch quá hạn, nhắc hẹn đến ngưỡng `nhắc trước`, bảo hành sắp hết.
- Lịch bảo trì/bảo hành/hiệu chuẩn/sửa chữa; xác nhận hoàn tất sẽ tự dời mốc bảo trì kế tiếp theo chu kỳ thiết bị.
- Báo cáo tùy chọn cột, lọc theo khoa/năm/tình trạng/nhà cung cấp, chấm chất lượng hồ sơ và xuất CSV mở được bằng Excel.

## Tài khoản khởi tạo

Mật khẩu mặc định: `Xuyena123`. Người dùng đổi mật khẩu tại menu tài khoản → **Đổi mật khẩu**.

- `admin` — admin tổng.
- `moderator-cu-chi`, `moderator-tay-ninh`, `moderator-long-an`, `moderator-vinh-long`, `moderator-tay-nguyen` — quản lý chi nhánh.
- Tài khoản khoa theo mẫu `<viet-tat-khoa>.<chi-nhanh>`, ví dụ `hstc.cu-chi`, `cap-cuu.tay-ninh`, `cdha.long-an`. Trang đăng nhập có danh sách đầy đủ theo từng chi nhánh.

Admin tổng và quản lý chi nhánh tạo thêm tài khoản tại **Đơn vị & phân quyền → Tài khoản**.
