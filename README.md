# WHISPER PRO  
## HỆ THỐNG CHUYỂN GIỌNG NÓI THÀNH VĂN BẢN  
## VÀ QUẢN LÝ CUỘC HỌP ỨNG DỤNG TRÍ TUỆ NHÂN TẠO

---

## 1. GIỚI THIỆU ĐỀ TÀI

Trong bối cảnh chuyển đổi số và sự phát triển mạnh mẽ của trí tuệ nhân tạo, việc tự động hóa quá trình ghi nhận, lưu trữ và xử lý nội dung các cuộc họp ngày càng trở nên cần thiết. Các cuộc họp truyền thống thường gặp khó khăn trong việc ghi chép đầy đủ nội dung, tốn nhiều thời gian tổng hợp và dễ xảy ra sai sót.

Đề tài **“Whisper Pro – Hệ thống chuyển giọng nói thành văn bản và quản lý cuộc họp”** được thực hiện nhằm xây dựng một hệ thống ứng dụng AI để:
- Tự động chuyển giọng nói thành văn bản (Speech-to-Text)
- Hỗ trợ ghi âm và quản lý nội dung các cuộc họp
- Tóm tắt nội dung cuộc họp nhằm tiết kiệm thời gian cho người dùng

Hệ thống được phát triển theo mô hình **Client – Server**, gồm **Backend xử lý AI** và **Frontend giao diện web**.

---

## 2. MỤC TIÊU ĐỀ TÀI

### 2.1. Mục tiêu tổng quát
Xây dựng một hệ thống web hoàn chỉnh ứng dụng trí tuệ nhân tạo để chuyển giọng nói thành văn bản và hỗ trợ quản lý cuộc họp một cách hiệu quả.

### 2.2. Mục tiêu cụ thể
- Nghiên cứu mô hình Whisper cho bài toán Speech-to-Text
- Xây dựng API xử lý phiên âm audio
- Phát triển giao diện web thân thiện cho người dùng
- Quản lý cuộc họp, lịch họp và người tham dự
- Tự động tóm tắt nội dung cuộc họp
- Đảm bảo hệ thống hoạt động ổn định và mở rộng được

---

## 3. PHẠM VI ĐỀ TÀI

- Chuyển giọng nói thành văn bản từ file audio hoặc ghi âm trực tiếp
- Quản lý cuộc họp ở quy mô nhỏ và trung bình
- Ngôn ngữ chính: Tiếng Việt (có thể mở rộng)
- Hệ thống phục vụ mục đích học tập, nghiên cứu và demo

---

## 4. KIẾN TRÚC HỆ THỐNG

Hệ thống được thiết kế theo kiến trúc 2 tầng:

Frontend (Web Browser)
│
│ REST API
▼
Backend (FastAPI)
│
├── Whisper (Speech-to-Text)
├── NLP Summarization (Sumy)
└── SQLite Database
---

## 5. CÔNG NGHỆ SỬ DỤNG

### 5.1. Backend
- Python 3
- FastAPI
- faster-whisper
- SQLAlchemy
- SQLite
- Sumy, NLTK
- Uvicorn
- Docker, Docker Compose

### 5.2. Frontend
- HTML5
- CSS3
- JavaScript (Vanilla JS)
- TailwindCSS
- FullCalendar
- MediaRecorder API

---

## 6. CÁC CHỨC NĂNG CHÍNH

### 6.1. Chức năng chuyển giọng nói thành văn bản
- Upload file audio
- Ghi âm trực tiếp từ microphone
- Xử lý phiên âm bất đồng bộ
- Hiển thị kết quả theo đoạn và timestamp

### 6.2. Chức năng quản lý cuộc họp
- Tạo, chỉnh sửa, xóa cuộc họp
- Quản lý người tham dự
- Hiển thị lịch họp
- Ghi âm và lưu trữ cuộc họp

### 6.3. Chức năng tóm tắt nội dung
- Tự động tóm tắt nội dung phiên âm
- Hỗ trợ người dùng nắm nhanh nội dung chính

---
---

## 7. TRIỂN KHAI HỆ THỐNG

### 7.1. Cài đặt Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload

Backend chạy tại: http://localhost:8000
**8. ĐÁNH GIÁ KẾT QUẢ**
8.1. Kết quả đạt được

Hệ thống hoạt động ổn định

Phiên âm chính xác với tiếng Việt

Giao diện thân thiện, dễ sử dụng

Quản lý cuộc họp hiệu quả

8.2. Hạn chế

Tóm tắt tiếng Việt chưa tối ưu

Chưa hỗ trợ phân quyền người dùng

Chưa triển khai trên môi trường production lớn

9. HƯỚNG PHÁT TRIỂN

Nâng cao chất lượng tóm tắt tiếng Việt

Tích hợp mô hình ngôn ngữ lớn (LLM)

Phân quyền người dùng

Lưu trữ cloud (S3, PostgreSQL)

Triển khai trên Kubernetes


