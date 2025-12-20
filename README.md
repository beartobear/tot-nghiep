Bản thảo `README.md` của bạn đã rất đầy đủ về mặt nội dung. Tuy nhiên, để chuyên nghiệp hơn và thu hút người dùng (đặc biệt là trên GitHub), mình đã tối ưu lại cấu trúc, thêm các biểu tượng (emoji) trực quan và định dạng lại các khối mã nguồn để dễ theo dõi hơn.

Dưới đây là phiên bản **README.md** đã được nâng cấp:

---

# 🎙️ Whisper Pro

### **AI-Powered Speech-to-Text & Meeting Management System**

**Whisper Pro** là giải pháp chuyển đổi giọng nói thành văn bản hiệu năng cao, tích hợp quản lý cuộc họp thông minh. Hệ thống được xây dựng trên nền tảng **FastAPI** và **faster-whisper**, cho phép xử lý âm thanh tốc độ cao, tóm tắt nội dung tự động và quản lý lịch trình tập trung.

---

## ✨ Tính năng nổi bật

### 🔊 Công nghệ Phiên âm (Speech-to-Text)

* **Engine:** Sử dụng `faster-whisper` cho tốc độ xử lý vượt trội so với phiên bản tiêu chuẩn.
* **Đa dạng đầu vào:** Hỗ trợ upload file (MP3, WAV, M4A, FLAC...) hoặc ghi âm trực tiếp từ trình duyệt.
* **Tính năng thông minh:** - Tự động nhận diện ngôn ngữ.
* Xuất Word timestamps (mốc thời gian từng từ).
* Tích hợp VAD (Voice Activity Detection) để loại bỏ khoảng lặng.
* Batched inference giúp tối ưu hóa hiệu suất phần cứng.



### 📝 Quản lý & Tóm tắt AI

* **Tóm tắt tự động:** Sử dụng thuật toán LSA (via Sumy) để trích xuất nội dung chính của cuộc họp.
* **Định dạng xuất bản:** Hỗ trợ xuất dữ liệu ra các định dạng chuyên dụng: `.txt`, `.srt` (phụ đề), và `.json`.

### 📅 Quản lý cuộc họp (Meeting Management)

* **Lịch biểu trực quan:** Hiển thị và quản lý cuộc họp qua giao diện **FullCalendar**.
* **Quản lý thực thể:** Lưu trữ thông tin chi tiết về thời gian, địa điểm (Online/Offline), chủ trì và thành viên tham dự.
* **Workflow tự động:** Upload file ghi âm → Phiên âm → Tóm tắt → Lưu trữ vào hồ sơ cuộc họp chỉ với 1 click.

### 🌐 Giao diện hiện đại

* Giao diện Web Responsive xây dựng với **TailwindCSS**.
* Trải nghiệm mượt mà, hỗ trợ cả 3 chế độ: Upload, Live Record và Calendar Task.

---

## 🏗️ Cấu trúc dự án

```text
├── app.py              # Backend FastAPI (API Entry Point)
├── client.py           # CLI Client để tương tác với API
├── models.py           # Pydantic schemas & Data models
├── requirements.txt    # Danh sách thư viện Python
├── Dockerfile          # Cấu hình Docker image
├── docker-compose.yaml # Cấu hình Docker Compose
├── static/             # Frontend Assets
│   ├── index.html      # Giao diện chính
│   ├── app.js          # Logic xử lý phía Client
│   └── style.css       # Custom Tailwind/CSS styles
└── storage/            # (Tự khởi tạo) Nơi lưu trữ audio và kết quả

```

---

## 🚀 Hướng dẫn cài đặt

### Cách 1: Sử dụng Docker (Khuyên dùng)

Nếu máy bạn đã cài Docker và Docker Compose:

```bash
git clone <your-repo-url>
cd whisper-pro
docker-compose up --build

```

Truy cập giao diện tại: `http://localhost:8000`

### Cách 2: Cài đặt thủ công

1. **Khởi tạo môi trường ảo:**
```bash
python -m venv venv
source venv/bin/activate  # Linux/macOS
# venv\Scripts\activate   # Windows

```


2. **Cài đặt Dependencies:**
```bash
pip install -r requirements.txt

```


3. **Khởi chạy Server:**
```bash
uvicorn app:app --host 0.0.0.0 --port 8000

```



---

## 🔌 Tài liệu API (API Documentation)

Hệ thống tự động tạo tài liệu API tại: `http://localhost:8000/docs`

### 🎙️ API Phiên âm

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/transcribe` | Upload audio và bắt đầu phiên âm |
| `GET` | `/api/tasks/{id}` | Kiểm tra trạng thái và nhận kết quả |

### 📅 API Cuộc họp

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| `GET` | `/api/meetings` | Lấy danh sách toàn bộ cuộc họp |
| `POST` | `/api/meetings` | Tạo cuộc họp mới |
| `POST` | `/api/.../process` | Xử lý file ghi âm cho cuộc họp cụ thể |

---

## 💻 CLI Client

Bạn có thể sử dụng file `client.py` để phiên âm nhanh từ terminal:

```bash
python client.py http://localhost:8000 audio_sample.wav output.txt

```

---

## ⚙️ Công nghệ sử dụng

* **Backend:** FastAPI (Python)
* **AI Engine:** faster-whisper (CTranslate2)
* **NLP:** Sumy, NLTK
* **Frontend:** TailwindCSS, Vanilla JS, FullCalendar
* **DevOps:** Docker, Uvicorn

---

## 📌 Ghi chú & Tối ưu hóa

* **Dữ liệu:** Hiện tại hệ thống đang lưu in-memory (sẽ mất khi restart server). Đối với môi trường Production, hãy cấu hình kết nối **PostgreSQL** hoặc **MongoDB**.
* **Tăng tốc GPU:** Nếu máy có card đồ họa NVIDIA, hãy thay đổi cấu hình trong `app.py`:
```python
# Chỉnh sửa model config
device="cuda", compute_type="float16"

```



---

*Phát triển bởi [Tên của bạn/Team]. Hy vọng Whisper Pro giúp ích cho công việc của bạn!*

---

