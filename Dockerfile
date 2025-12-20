FROM nvidia/cuda:12.1.0-base-ubuntu22.04

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    NLTK_DATA=/usr/share/nltk_data \
    MODEL_DIR=/app/models \
    HF_HOME=/app/.cache \
    HUGGINGFACE_HUB_CACHE=/app/.cache \
    XDG_CACHE_HOME=/app/.cache \
    HOME=/app \
    TZ=Asia/Ho_Chi_Minh

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    wget \
    curl \
    git \
    sqlite3 \
    libsqlite3-dev \
    build-essential \
    cmake \
    pkg-config \
    libsndfile1 \
    libavcodec-dev \
    libavformat-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libavfilter-dev \
    libopenblas-dev \
    libomp-dev \
    libcurl4-openssl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3 1
    # Dòng trên sẽ tạo alias python -> python3 đúng cách

RUN mkdir -p \
    /app/static/css \
    /app/static/js \
    /app/static/logo \
    /app/templates \
    /app/data \
    /app/samples \
    /app/models \
    /usr/share/nltk_data

# Create a writable cache directory for HuggingFace hub and ensure permissions
RUN mkdir -p /app/.cache/huggingface && \
    chmod -R 0777 /app/.cache && \
    chmod -R 0777 /app/models
RUN mkdir -p /app && chmod -R 0777 /app

RUN chmod -R 755 /app
RUN chown -R 1000:1000 /app || true

COPY requirements.txt .
RUN pip3 install --no-cache-dir --upgrade pip \
    && pip3 install --no-cache-dir -r requirements.txt

# Tải dữ liệu NLTK
RUN python3 -c "import nltk; nltk.download('punkt', download_dir='/usr/share/nltk_data'); nltk.download('stopwords', download_dir='/usr/share/nltk_data')"

# Copy các file cần thiết
COPY app.py models.py database.py ./
COPY data/init_db.py ./data/init_db.py

# Tạo thư mục và file cần thiết nếu chưa có
RUN if [ ! -d "routers" ]; then mkdir -p routers; fi \
    && if [ ! -d "templates" ]; then mkdir -p templates; fi \
    && if [ ! -d "static" ]; then mkdir -p static; fi

EXPOSE 8000

# Khởi tạo database và chạy app
CMD ["sh", "-c", "python data/init_db.py && uvicorn app:app --host 0.0.0.0 --port 8000"]