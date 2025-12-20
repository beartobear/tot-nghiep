🎙️ Whisper Transcription API with Meeting Management
Hệ thống cung cấp API chuyển đổi giọng nói thành văn bản (Speech-to-Text) hiệu suất cao sử dụng Faster-Whisper, tích hợp quản lý cuộc họp, tự động tóm tắt nội dung và lưu trữ dữ liệu.

✨ Tính năng chính
Transcription Hiệu Suất Cao: Sử dụng faster-whisper hỗ trợ tăng tốc trên cả CPU và GPU (NVIDIA CUDA).

Quản lý Cuộc họp: API đầy đủ cho các thao tác CRUD (Tạo, Đọc, Cập nhật, Xóa) cuộc họp.

Tự động Tóm tắt: Sử dụng thư viện sumy (LSA Summarizer) để tóm tắt nội dung sau khi phiên âm.

Xử lý Bất đồng bộ: File âm thanh được xử lý dưới background task để không gây nghẽn API.

Hỗ trợ Lịch (Calendar): Endpoint trả về dữ liệu tương thích với FullCalendar.

Dockerized: Sẵn sàng triển khai nhanh chóng với Docker và Docker Compose.

🛠️ Công nghệ sử dụng
Backend: FastAPI (Python 3.10+)

AI Model: Faster-Whisper (Large-v3, Base, etc.)

Database: SQLAlchemy với SQLite (mặc định)

Summarization: Sumy (Natural Language Processing)

Containerization: Docker, NVIDIA Container Toolkit (cho GPU)

Cách 1: Sử dụng Docker (Khuyến nghị)
Yêu cầu: Đã cài đặt Docker và Docker Compose. Nếu dùng GPU, hãy cài thêm NVIDIA Container Toolkit.

Clone dự án và di chuyển vào thư mục gốc.

Khởi chạy hệ thống:

Bash

docker-compose up -d --build
Hệ thống sẽ tự động khởi tạo database tại data/app.db và chạy server tại cổng 8000.

Cách 2: Cài đặt thủ công
Tạo môi trường ảo:

Bash

python -m venv venv
source venv/bin/activate  # Linux/macOS
# hoặc venv\Scripts\activate  # Windows
Cài đặt thư viện:

Bash

pip install -r requirements.txt
Cài đặt FFmpeg: Đảm bảo máy tính đã cài đặt ffmpeg.

Chạy ứng dụng:

Bash

python app.py

API Endpoints chính
Endpoint,Phương thức,Mô tả
/api/transcribe,POST,Upload file âm thanh để phiên âm (Form-data)
/api/tasks/{id},GET,Kiểm tra trạng thái và nhận kết quả phiên âm
/api/meetings,POST,Tạo thông tin cuộc họp mới
/api/meetings/{id}/process-recording,POST,Upload file ghi âm cuộc họp và tự động tóm tắt
/api/meetings/calendar,GET,Lấy danh sách cuộc họp theo định dạng lịch
/api/health,GET,Kiểm tra trạng thái hệ thống và database
Sử dụng Client mẫu
python client.py http://localhost:8000 path/to/your/audio.mp3 output.txt

Cấu hình môi trường (Docker)
Các biến môi trường quan trọng trong docker-compose.yaml:

PRELOAD_MODEL: Model mặc định tải khi khởi động (ví dụ: tiny, base, large-v3).

DATABASE_URL: Đường dẫn kết nối SQLite.

NVIDIA_VISIBLE_DEVICES: Đặt là all để sử dụng GPU.