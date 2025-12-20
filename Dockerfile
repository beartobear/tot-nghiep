# Base image with CUDA support
FROM nvidia/cuda:12.1.0-base-ubuntu22.04

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    NLTK_DATA=/usr/share/nltk_data \
    MODEL_DIR=/app/models \
    TZ=Asia/Ho_Chi_Minh

# Install system dependencies
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
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Create necessary directories
RUN mkdir -p \
    /app/static/css \
    /app/static/js \
    /app/static/logo \
    /app/templates \
    /app/data \
    /app/samples \
    /app/models \
    /usr/share/nltk_data

# Set permissions
RUN chmod -R 755 /app/static /app/templates /usr/share/nltk_data

# Upgrade pip and install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir -r requirements.txt

# --- TẢI DỮ LIỆU NLTK ---
# Download NLTK data packages
RUN python3 -c "import nltk; nltk.download('punkt', download_dir='/usr/share/nltk_data', quiet=True); nltk.download('stopwords', download_dir='/usr/share/nltk_data', quiet=True)"

# Copy application code
COPY . .

# Verify file structure
RUN echo "=== File Structure ===" && \
    ls -la && \
    echo "=== Templates ===" && \
    ls -la templates/ 2>/dev/null || echo "Templates directory not found" && \
    echo "=== Static ===" && \
    ls -la static/ 2>/dev/null || echo "Static directory not found"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Command to run the application with auto-reload for development
# For production, remove --reload flag
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]