from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException, Query, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
import base64
from sqlalchemy import desc, or_, and_, text
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import os
import uuid
import logging
import uvicorn
import asyncio
import shutil
import time
import requests
from pathlib import Path
import tempfile
import json
from faster_whisper import WhisperModel
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words
from concurrent.futures import ThreadPoolExecutor
import nltk
from sqlalchemy.orm import Session, joinedload

# Database imports
from database import get_db, engine, Base, SessionLocal
from models import Meeting, Transcription, Participant

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("whisper-api")

# Download NLTK data
try:
    nltk.download('punkt', quiet=True)
except:
    pass

# ==================== CẤU HÌNH HẰNG SỐ ====================
MAX_AUDIO_SIZE = 50 * 1024 * 1024  # 50MB

# ==================== THƯ MỤC LƯU TRỮ ====================
# Create necessary directories
os.makedirs("static", exist_ok=True)
os.makedirs("static/js", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/logo", exist_ok=True)
os.makedirs("data", exist_ok=True)
os.makedirs("data/transcriptions", exist_ok=True)
os.makedirs("data/meeting_audio", exist_ok=True)
os.makedirs("templates", exist_ok=True)

MEETING_AUDIO_DIR = Path("data/meeting_audio")

# ==================== APP INITIALIZATION ====================
app = FastAPI(
    title="Whisper Pro - AI Transcription & Meeting Management",
    description="High-performance speech-to-text API with integrated meeting management",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

@app.on_event("startup")
async def preload_default_model():
    """Preload the default model on startup"""
    try:
        model_size = os.environ.get("PRELOAD_MODEL", "large-v3")
        logger.info(f"🎯 Scheduling background preload for model: {model_size}")

        async def _bg_load():
            try:
                logger.info("🔄 Background model preload started...")
                # Load model in background thread
                await asyncio.to_thread(
                    WhisperModel,
                    model_size,
                    device="cpu",
                    compute_type="int8",
                    download_root=os.environ.get("MODEL_DIR", None)
                )
                logger.info("✅ Background model preload complete.")
            except Exception as e:
                logger.error(f"❌ Background model preload failed: {e}")

        asyncio.create_task(_bg_load())
    except Exception as e:
        logger.error(f"❌ Model preload scheduling failed: {e}")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==================== DATABASE INITIALIZATION ====================
Base.metadata.create_all(bind=engine)

# ==================== DATA STORES & CACHE ====================
UPLOAD_DIR = Path(tempfile.gettempdir()) / "whisper_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

transcription_tasks = {}
model_cache = {}
executor = ThreadPoolExecutor(max_workers=4)

# ==================== PYDANTIC MODELS ====================

# Enums
class MeetingStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TranscriptionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

# Participant Model
class ParticipantCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Tên người tham dự")
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_required: bool = True

class ParticipantResponse(ParticipantCreate):
    id: str
    
    class Config:
        from_attributes = True

# Meeting Models
class MeetingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Tiêu đề cuộc họp")
    description: Optional[str] = None
    start_time: datetime = Field(..., description="Thời gian bắt đầu")
    end_time: datetime = Field(..., description="Thời gian kết thúc")
    location_type: str = Field("physical", description="physical (phòng họp) hoặc online")
    location: Optional[str] = Field(None, description="Tên phòng hoặc link online")
    organizer: str = Field(..., description="Người chủ trì/tổ chức")
    status: MeetingStatus = MeetingStatus.DRAFT
    recurrence_rule: Optional[str] = None
    tags: List[str] = []
    
    @field_validator('end_time')
    @classmethod
    def validate_time_range(cls, v: datetime, info) -> datetime:
        start_time = info.data.get('start_time')
        if start_time and v <= start_time:
            raise ValueError('Thời gian kết thúc phải sau thời gian bắt đầu')
        return v

class MeetingCreate(MeetingBase):
    participants: List[ParticipantCreate] = []

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[MeetingStatus] = None
    participants: Optional[List[ParticipantCreate]] = None
    tags: Optional[List[str]] = None

class MeetingResponse(MeetingBase):
    id: str
    participants: List[ParticipantResponse] = []
    created_at: datetime
    updated_at: datetime
    audio_file_path: Optional[str] = None
    audio_file_name: Optional[str] = None
    audio_file_size: Optional[float] = None
    transcription_id: Optional[str] = None
    summary: Optional[str] = None
    # Ensure tags is always a list when returned from ORM (convert None->[])
    tags: List[str] = Field(default_factory=list)
    
    @field_validator('tags', mode='before')
    @classmethod
    def _coerce_tags(cls, v):
        # If the ORM stored tags as a JSON string (e.g. "[]"), parse it
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        if v is None:
            return []
        return v

    class Config:
        from_attributes = True

# Transcription Models
class TranscriptionOptions(BaseModel):
    model_size: str = Field("large-v3", description="Model size to use for transcription")
    device: str = Field("cpu", description="Device to use for computation (cuda, cpu)")
    compute_type: str = Field("int8", description="Compute type for model (float16, int8_float16, int8)")
    language: Optional[str] = Field(None, description="Language code for transcription (e.g., 'en', 'fr')")
    batch_size: Optional[int] = Field(16, description="Batch size for transcription when using batched mode")
    beam_size: int = Field(5, description="Beam size for transcription")
    word_timestamps: bool = Field(False, description="Whether to include timestamps for each word")
    vad_filter: bool = Field(True, description="Whether to apply voice activity detection")
    vad_parameters: Optional[Dict[str, Any]] = Field(None, description="Parameters for VAD filtering")
    condition_on_previous_text: bool = Field(True, description="Whether to condition on previous text")
    use_batched_mode: bool = Field(True, description="Whether to use batched inference for faster processing")

class TranscriptionTask(BaseModel):
    id: str
    status: str
    created_at: str
    file_name: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class TranscriptionSegment(BaseModel):
    id: int
    seek: int
    start: float
    end: float
    text: str
    tokens: List[int]
    temperature: float
    avg_logprob: float
    compression_ratio: float
    no_speech_prob: float
    words: Optional[List[Dict[str, Any]]] = None

class TranscriptionResult(BaseModel):
    segments: List[TranscriptionSegment]
    language: str
    language_probability: float
    processing_time: Optional[float] = None
    audio_duration: Optional[float] = None

# Summary Models
class SummaryRequest(BaseModel):
    full_transcript: str = Field(..., description="Full transcript text to summarize")
    language_code: str = Field("vi", description="Language code for summarization")

class SummaryResponse(BaseModel):
    summary: str = Field(..., description="Generated summary")

# ==================== MEETING MANAGEMENT ENDPOINTS ====================

@app.post("/api/meetings", response_model=MeetingResponse)
async def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    """Tạo cuộc họp mới"""
    meeting_id = str(uuid.uuid4())
    now = datetime.now()
    
    # Create meeting
    db_meeting = Meeting(
        id=meeting_id,
        title=meeting.title,
        description=meeting.description,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        location_type=meeting.location_type,
        location=meeting.location,
        organizer=meeting.organizer,
        status=meeting.status.value,
        created_at=now,
        updated_at=now
    )
    
    if meeting.tags:
        db_meeting.set_tags_list(meeting.tags)
    
    db.add(db_meeting)
    
    # Add participants
    for participant in meeting.participants:
        db_participant = Participant(
            id=str(uuid.uuid4()),
            meeting_id=meeting_id,
            name=participant.name,
            email=participant.email,
            role=participant.role,
            department=participant.department,
            is_required=participant.is_required
        )
        db.add(db_participant)
    
    db.commit()
    db.refresh(db_meeting)
    
    logger.info(f"✅ Created meeting: {meeting_id} - {meeting.title}")
    
    return MeetingResponse.from_orm(db_meeting)

@app.get("/api/meetings/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Lấy thông tin chi tiết cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    return MeetingResponse.from_orm(meeting)

@app.get("/api/meetings", response_model=List[MeetingResponse])
async def list_meetings(
    status: Optional[MeetingStatus] = None,
    organizer: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Danh sách cuộc họp với các bộ lọc"""
    query = db.query(Meeting)
    
    # Apply filters
    if status:
        query = query.filter(Meeting.status == status.value)
    if organizer:
        query = query.filter(Meeting.organizer.ilike(f"%{organizer}%"))
    if start_date:
        query = query.filter(Meeting.start_time >= start_date)
    if end_date:
        query = query.filter(Meeting.end_time <= end_date)
    
    # Get meetings
    meetings = query.order_by(Meeting.start_time.desc()).offset(offset).limit(limit).all()
    
    return [MeetingResponse.from_orm(meeting) for meeting in meetings]

@app.put("/api/meetings/{meeting_id}", response_model=MeetingResponse)
async def update_meeting(
    meeting_id: str,
    meeting_update: MeetingUpdate,
    db: Session = Depends(get_db)
):
    """Cập nhật thông tin cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    # Update meeting fields
    update_data = meeting_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value:
            setattr(meeting, field, value.value)
        elif field == "tags" and value:
            meeting.set_tags_list(value)
        elif field == "participants" and value:
            # Delete existing participants
            db.query(Participant).filter(Participant.meeting_id == meeting_id).delete()
            # Add new participants
            for participant in value:
                db_participant = Participant(
                    id=str(uuid.uuid4()),
                    meeting_id=meeting_id,
                    name=participant.name,
                    email=participant.email,
                    role=participant.role,
                    department=participant.department,
                    is_required=participant.is_required
                )
                db.add(db_participant)
        elif value is not None:
            setattr(meeting, field, value)
    
    meeting.updated_at = datetime.now()
    db.commit()
    db.refresh(meeting)
    
    logger.info(f"✅ Updated meeting: {meeting_id}")
    
    return MeetingResponse.from_orm(meeting)

@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Xóa cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    # Delete associated files
    if meeting.audio_file_path and os.path.exists(meeting.audio_file_path):
        try:
            os.remove(meeting.audio_file_path)
        except Exception as e:
            logger.error(f"Error deleting audio file: {e}")
    
    # Delete transcription file if exists
    if meeting.transcription_id:
        transcription_file = Path("data/transcriptions") / f"transcription_{meeting.transcription_id}.json"
        if transcription_file.exists():
            try:
                os.remove(transcription_file)
            except Exception as e:
                logger.error(f"Error deleting transcription file: {e}")
    
    # Delete from database
    db.delete(meeting)
    db.commit()
    
    logger.info(f"✅ Deleted meeting: {meeting_id}")
    return {"message": "Đã xóa cuộc họp thành công", "meeting_id": meeting_id}

@app.get("/api/meetings/calendar")
async def get_calendar_events(
    start: datetime = Query(..., description="Ngày bắt đầu (ISO format)"),
    end: datetime = Query(..., description="Ngày kết thúc (ISO format)"),
    db: Session = Depends(get_db)
):
    """Lấy sự kiện cho calendar"""
    events = []
    
    meetings = db.query(Meeting).filter(
        Meeting.start_time >= start,
        Meeting.end_time <= end
    ).all()
    
    # Status colors
    status_colors = {
        "draft": "#6B7280",
        "scheduled": "#3B82F6",
        "in_progress": "#F59E0B",
        "completed": "#10B981",
        "cancelled": "#EF4444",
    }
    
    for meeting in meetings:
        events.append({
            "id": meeting.id,
            "title": meeting.title,
            "start": meeting.start_time.isoformat(),
            "end": meeting.end_time.isoformat(),
            "location": meeting.location or "",
            "organizer": meeting.organizer,
            "status": meeting.status,
            "color": status_colors.get(meeting.status, "#3B82F6"),
            "extendedProps": {
                "description": meeting.description or "",
                "location_type": meeting.location_type or "physical",
                "has_audio": bool(meeting.audio_file_path),
                "has_transcription": bool(meeting.transcription_id)
            }
        })
    
    return events

@app.post("/api/meetings/{meeting_id}/record-audio")
async def record_meeting_audio(
    meeting_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """Upload và lưu file ghi âm cho cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    try:
        # Validate file size
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks
        
        # Read file in chunks to get size
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            file_size += len(chunk)
        
        # Reset file pointer
        await file.seek(0)
        
        if file_size > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File quá lớn. Kích thước tối đa: {MAX_AUDIO_SIZE // (1024*1024)}MB"
            )
        
        # Create unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = file.filename.replace(" ", "_").replace("/", "_")
        file_name = f"meeting_{meeting_id}_{timestamp}_{safe_filename}"
        file_path = MEETING_AUDIO_DIR / file_name
        
        # Save file
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # Update meeting info
        meeting.status = "in_progress"
        meeting.audio_file_path = str(file_path)
        meeting.audio_file_name = file.filename
        meeting.audio_file_size = file_size / (1024 * 1024)  # MB
        meeting.updated_at = datetime.now()
        db.commit()
        
        logger.info(f"✅ Saved audio for meeting {meeting_id}: {file_path} ({meeting.audio_file_size:.2f} MB)")
        
        # Process audio in background
        background_tasks.add_task(
            process_meeting_audio_background,
            meeting_id=meeting_id,
            audio_path=str(file_path)
        )
        
        return {
            "message": "File ghi âm đã được lưu thành công và đang xử lý",
            "meeting_id": meeting_id,
            "file_name": file.filename,
            "file_size_mb": f"{meeting.audio_file_size:.2f}",
            "file_path": str(file_path),
            "status": "in_progress"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error saving audio for meeting {meeting_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu file ghi âm: {str(e)}")

async def process_meeting_audio_background(meeting_id: str, audio_path: str):
    """Xử lý audio cuộc họp trong background: phiên âm và tóm tắt"""
    db = SessionLocal()
    try:
        logger.info(f"🔄 Processing audio in background for meeting {meeting_id}: {audio_path}")
        
        # Check if file exists
        if not os.path.exists(audio_path):
            logger.error(f"❌ Audio file not found: {audio_path}")
            return
        
        # 1. Transcribe using Whisper
        try:
            options = TranscriptionOptions(
                model_size="base",
                device="cpu",
                compute_type="int8",
                language="vi",
                word_timestamps=False,
                vad_filter=True,
                use_batched_mode=False
            )
            
            key = f"{options.model_size}_{options.device}_{options.compute_type}"
            if key not in model_cache:
                logger.info(f"📥 Loading model for meeting transcription: {options.model_size}")
                model = WhisperModel(
                    options.model_size,
                    device=options.device,
                    compute_type=options.compute_type,
                    download_root=os.environ.get("MODEL_DIR", None)
                )
                model_cache[key] = model
            
            model = model_cache[key]
            
            # Run transcription
            logger.info(f"🎤 Starting transcription for meeting {meeting_id}")
            segments, info = model.transcribe(
                audio_path,
                beam_size=5,
                language="vi",
                vad_filter=True,
                vad_parameters={
                    "threshold": 0.5,
                    "min_speech_duration_ms": 250,
                    "min_silence_duration_ms": 2000
                }
            )
            
            segments_list = list(segments)
            transcript_text = " ".join([segment.text for segment in segments_list])
            
            logger.info(f"✅ Transcription completed for meeting {meeting_id}, {len(segments_list)} segments")
            
            # 2. Create summary from transcript
            summary = await summarize_text_async(transcript_text, "vi")
            
            # 3. Update meeting info in database
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            
            if meeting:
                transcription_id = str(uuid.uuid4())
                transcription_result = {
                    "segments": [
                        {
                            "id": i,
                            "start": seg.start,
                            "end": seg.end,
                            "text": seg.text
                        }
                        for i, seg in enumerate(segments_list)
                    ],
                    "language": info.language,
                    "language_probability": info.language_probability,
                    "full_text": transcript_text,
                    "meeting_id": meeting_id,
                    "audio_path": audio_path,
                    "created_at": datetime.now().isoformat()
                }
                
                # Save transcription to file
                data_dir = Path("data") / "transcriptions"
                data_dir.mkdir(exist_ok=True)
                
                transcription_file = data_dir / f"transcription_{transcription_id}.json"
                with open(transcription_file, 'w', encoding='utf-8') as f:
                    json.dump(transcription_result, f, ensure_ascii=False, indent=2)
                
                # Update meeting
                meeting.transcription_id = transcription_id
                meeting.summary = summary
                meeting.status = "completed"
                meeting.updated_at = datetime.now()
                db.commit()
                
                logger.info(f"✅ Finished processing audio for meeting {meeting_id}")
            
        except Exception as e:
            logger.error(f"❌ Transcription error for meeting {meeting_id}: {str(e)}")
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if meeting:
                meeting.updated_at = datetime.now()
                db.commit()
        
    except Exception as e:
        logger.error(f"❌ Error processing meeting audio for {meeting_id}: {str(e)}")
    finally:
        db.close()

@app.get("/api/meetings/{meeting_id}/audio")
async def get_meeting_audio(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Lấy file audio của cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    if not meeting.audio_file_path:
        raise HTTPException(status_code=404, detail="Cuộc họp không có file ghi âm")
    
    # Check if file exists
    if not os.path.exists(meeting.audio_file_path):
        raise HTTPException(status_code=404, detail="File audio không tồn tại trên server")
    
    # Determine content type
    if meeting.audio_file_path.endswith('.mp3'):
        media_type = "audio/mpeg"
    elif meeting.audio_file_path.endswith('.wav'):
        media_type = "audio/wav"
    elif meeting.audio_file_path.endswith('.webm'):
        media_type = "audio/webm"
    else:
        media_type = "audio/mpeg"
    
    return FileResponse(
        path=meeting.audio_file_path,
        media_type=media_type,
        filename=meeting.audio_file_name or f"recording_{meeting_id}.webm"
    )

@app.delete("/api/meetings/{meeting_id}/audio")
async def delete_meeting_audio(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Xóa file audio của cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    try:
        # Delete file from disk
        if meeting.audio_file_path and os.path.exists(meeting.audio_file_path):
            os.remove(meeting.audio_file_path)
            logger.info(f"🗑️ Deleted audio file: {meeting.audio_file_path}")
        
        # Update database
        meeting.audio_file_path = None
        meeting.audio_file_name = None
        meeting.audio_file_size = None
        meeting.updated_at = datetime.now()
        db.commit()
        
        return {"message": "Đã xóa file ghi âm", "meeting_id": meeting_id}
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error deleting audio for meeting {meeting_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa file ghi âm: {str(e)}")

@app.get("/api/meetings/with-audio")
async def list_meetings_with_audio(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Danh sách cuộc họp có audio"""
    meetings = db.query(Meeting).filter(
        Meeting.audio_file_path.isnot(None)
    ).order_by(desc(Meeting.updated_at)).limit(limit).all()
    
    result = []
    for meeting in meetings:
        result.append({
            "id": meeting.id,
            "title": meeting.title,
            "organizer": meeting.organizer,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "audio_file_name": meeting.audio_file_name,
            "audio_file_size": meeting.audio_file_size,
            "has_transcription": bool(meeting.transcription_id),
            "has_summary": bool(meeting.summary),
            "status": meeting.status,
            "location": meeting.location,
            "location_type": meeting.location_type,
            "transcription_id": meeting.transcription_id
        })
    
    return result

@app.get("/api/meetings/{meeting_id}/transcription")
async def get_meeting_transcription(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Lấy bản phiên âm của cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    if not meeting.transcription_id:
        raise HTTPException(status_code=404, detail="Cuộc họp chưa có transcription")
    
    try:
        data_dir = Path("data") / "transcriptions"
        transcription_file = data_dir / f"transcription_{meeting.transcription_id}.json"
        
        if not transcription_file.exists():
            raise HTTPException(status_code=404, detail="Không tìm thấy file transcription")
        
        with open(transcription_file, 'r', encoding='utf-8') as f:
            transcription_data = json.load(f)
        
        # Add meeting info
        transcription_data["meeting_info"] = {
            "title": meeting.title,
            "start_time": meeting.start_time.isoformat() if meeting.start_time else None,
            "organizer": meeting.organizer,
            "meeting_id": meeting.id
        }
        
        return transcription_data
        
    except Exception as e:
        logger.error(f"❌ Error loading transcription for meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi đọc transcription: {str(e)}")

@app.delete("/api/meetings/{meeting_id}/transcription")
async def delete_meeting_transcription(
    meeting_id: str,
    db: Session = Depends(get_db)
):
    """Xóa bản phiên âm của cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    if not meeting.transcription_id:
        raise HTTPException(status_code=404, detail="Cuộc họp không có transcription")
    
    try:
        data_dir = Path("data") / "transcriptions"
        transcription_file = data_dir / f"transcription_{meeting.transcription_id}.json"
        
        if transcription_file.exists():
            os.remove(transcription_file)
        
        meeting.transcription_id = None
        meeting.summary = None
        meeting.updated_at = datetime.now()
        db.commit()
        
        return {"message": "Đã xóa transcription thành công", "meeting_id": meeting_id}
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error deleting transcription for meeting {meeting_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa transcription: {str(e)}")

# ==================== TRANSCRIPTION ENDPOINTS ====================

def get_or_load_model(options: TranscriptionOptions):
    """Get or load model from cache"""
    key = f"{options.model_size}_{options.device}_{options.compute_type}"
    
    if key not in model_cache:
        logger.info(f"📥 Loading model: {options.model_size} on {options.device} with {options.compute_type}")
        model = WhisperModel(
            options.model_size,
            device=options.device,
            compute_type=options.compute_type,
            download_root=os.environ.get("MODEL_DIR", None)
        )
        model_cache[key] = model
    
    return model_cache[key]

async def summarize_text_async(text: str, language_code: str) -> Optional[str]:
    """Summarize text asynchronously"""
    language_map = {
        "en": "english",
        "vi": "english",  # Sumy doesn't have Vietnamese, use English tokenizer
        "fr": "french",
        "de": "german",
        "es": "spanish",
        "zh": "english",
        "ja": "english"
    }
    
    LANGUAGE = language_map.get(language_code, "english")
    SENTENCES_COUNT = 3
    
    def sumy_task(text_to_summarize):
        if not text_to_summarize or len(text_to_summarize.strip()) < 100:
            return "Văn bản quá ngắn để tóm tắt."
            
        try:
            parser = PlaintextParser.from_string(text_to_summarize, Tokenizer("english"))
            
            stemmer = Stemmer(LANGUAGE)
            summarizer = LsaSummarizer(stemmer)
            summarizer.stop_words = get_stop_words(LANGUAGE)
            
            summary_sentences = summarizer(parser.document, SENTENCES_COUNT)
            summary_text = " ".join([str(sentence) for sentence in summary_sentences])
            
            return summary_text if summary_text.strip() else "Không thể tạo bản tóm tắt từ văn bản này."
            
        except Exception as e:
            logger.error(f"❌ Error during Sumy summarization: {e}")
            return f"Lỗi tóm tắt: {str(e)}"

    loop = asyncio.get_event_loop()
    summary = await loop.run_in_executor(executor, sumy_task, text)
    return summary

async def process_transcription(task_id: str, file_path: str, options: TranscriptionOptions):
    """Process transcription in background"""
    try:
        transcription_tasks[task_id]["status"] = "processing"
        
        # Load model
        model = get_or_load_model(options)
        
        # Prepare transcription parameters
        kwargs = {
            "beam_size": options.beam_size,
            "word_timestamps": options.word_timestamps,
            "vad_filter": options.vad_filter,
            "condition_on_previous_text": options.condition_on_previous_text,
        }
        
        if options.language:
            kwargs["language"] = options.language
            
        if options.vad_parameters:
            kwargs["vad_parameters"] = options.vad_parameters
        
        # Run transcription
        start_time = datetime.now()
        segments, info = model.transcribe(file_path, **kwargs)
        segments_list = list(segments)
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Prepare result
        segments_data = []
        for i, segment in enumerate(segments_list):
            segment_data = {
                "id": i,
                "seek": segment.seek,
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
                "tokens": segment.tokens,
                "temperature": segment.temperature,
                "avg_logprob": segment.avg_logprob,
                "compression_ratio": segment.compression_ratio,
                "no_speech_prob": segment.no_speech_prob,
            }
            
            if options.word_timestamps and hasattr(segment, 'words'):
                segment_data["words"] = [
                    {"word": word.word, "start": word.start, "end": word.end, "probability": word.probability}
                    for word in segment.words
                ]
                
            segments_data.append(segment_data)
        
        result = {
            "segments": segments_data,
            "language": info.language,
            "language_probability": info.language_probability,
            "processing_time": processing_time,
            "audio_duration": segments_list[-1].end if segments_list else 0,
        }
        
        transcription_tasks[task_id]["status"] = "completed"
        transcription_tasks[task_id]["result"] = result
        
        logger.info(f"✅ Transcription completed for task {task_id}")
        
    except Exception as e:
        logger.exception(f"❌ Error processing transcription: {str(e)}")
        transcription_tasks[task_id]["status"] = "failed"
        transcription_tasks[task_id]["error"] = str(e)
    finally:
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
        except Exception as e:
            logger.error(f"❌ Error removing temporary file: {str(e)}")

def parse_form_options(
    model_size: str = Form("large-v3"),
    device: str = Form("cpu"),
    compute_type: str = Form("int8"),
    language: Optional[str] = Form(None),
    batch_size: int = Form(16),
    beam_size: int = Form(5),
    word_timestamps: str = Form("false"),
    vad_filter: str = Form("true"),
    condition_on_previous_text: str = Form("true"),
    use_batched_mode: str = Form("true")
) -> TranscriptionOptions:
    """Parse form data to TranscriptionOptions"""
    word_timestamps_bool = word_timestamps.lower() == "true"
    vad_filter_bool = vad_filter.lower() == "true"
    condition_on_previous_text_bool = condition_on_previous_text.lower() == "true"
    use_batched_mode_bool = use_batched_mode.lower() == "true"
    
    return TranscriptionOptions(
        model_size=model_size,
        device=device,
        compute_type=compute_type,
        language=language,
        batch_size=batch_size,
        beam_size=beam_size,
        word_timestamps=word_timestamps_bool,
        vad_filter=vad_filter_bool,
        condition_on_previous_text=condition_on_previous_text_bool,
        use_batched_mode=use_batched_mode_bool
    )

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve main HTML page"""
    try:
        with open("templates/index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error(f"❌ Error loading template: {e}")
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Whisper Pro - AI Transcription</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center justify-center">
            <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
                <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                    <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <h1 class="text-2xl font-bold text-gray-900 mb-4">Whisper Pro API</h1>
                <p class="text-gray-600 mb-6">✅ Backend đang chạy. Vui lòng truy cập giao diện chính:</p>
                <a href="/index.html" class="block w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition mb-3">
                    📱 Mở Giao Diện Chính
                </a>
                <div class="space-y-2 mt-6 text-sm">
                    <a href="/api/docs" class="text-blue-600 hover:underline block">📚 API Documentation (Swagger UI)</a>
                    <a href="/api/health" class="text-green-600 hover:underline block">💚 Health Check</a>
                </div>
            </div>
        </body>
        </html>""")

@app.get("/index.html", response_class=HTMLResponse)
async def serve_index_html():
    return await read_root()

@app.post("/api/transcribe", response_model=TranscriptionTask)
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    options: TranscriptionOptions = Depends(parse_form_options)
):
    """Transcribe audio file"""
    logger.info(f"🎯 Received transcription request with options: {options}")
    
    # Create task
    task_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{task_id}_{file.filename}"
    
    try:
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
    
    # Create task entry
    task = {
        "id": task_id,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "file_name": file.filename,
    }
    
    transcription_tasks[task_id] = task
    
    # Start processing in background
    background_tasks.add_task(
        process_transcription,
        task_id=task_id,
        file_path=str(file_path),
        options=options
    )
    
    return JSONResponse(status_code=202, content=task)

@app.post("/api/summarize", response_model=SummaryResponse)
async def summarize_text_api(data: SummaryRequest):
    """Summarize transcript text"""
    raw_text = data.full_transcript
    language_code = data.language_code
    
    if not raw_text:
        raise HTTPException(status_code=400, detail="Missing full_transcript in request body.")
        
    word_count = len(raw_text.split())
    if word_count < 30:
        return {"summary": "Văn bản quá ngắn để tóm tắt hiệu quả."}

    try:
        summary = await summarize_text_async(raw_text, language_code)
        return {"summary": summary}
    except Exception as e:
        logger.error(f"❌ Summarization API error: {e}")
        return {"summary": f"Lỗi trong quá trình tóm tắt: {str(e)}"}

@app.get("/api/tasks/{task_id}", response_model=TranscriptionTask)
async def get_task(task_id: str):
    """Get transcription task status"""
    if task_id not in transcription_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return transcription_tasks[task_id]

@app.get("/api/tasks", response_model=List[TranscriptionTask])
async def list_tasks(limit: int = 10, status: Optional[str] = None):
    """List transcription tasks"""
    tasks = list(transcription_tasks.values())
    
    if status:
        tasks = [task for task in tasks if task["status"] == status]
    
    tasks.sort(key=lambda x: x["created_at"], reverse=True)
    
    return tasks[:limit]

@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    try:
        # Check database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
        
        # Get statistics
        meetings_count = db.query(Meeting).count()
        transcriptions_count = db.query(Meeting).filter(Meeting.transcription_id.isnot(None)).count()
        
        # Check transcription files
        data_dir = Path("data") / "transcriptions"
        transcription_files_count = len(list(data_dir.glob("*.json"))) if data_dir.exists() else 0
        
        # Check audio files
        audio_files_count = len(list(MEETING_AUDIO_DIR.glob("*"))) if MEETING_AUDIO_DIR.exists() else 0
        
        return {
            "status": "healthy", 
            "timestamp": datetime.now().isoformat(),
            "database": db_status,
            "statistics": {
                "meetings_count": meetings_count,
                "transcriptions_count": transcriptions_count,
                "transcription_files": transcription_files_count,
                "audio_files": audio_files_count,
                "active_tasks": len(transcription_tasks),
                "cached_models": len(model_cache)
            },
            "limits": {
                "max_audio_size_mb": MAX_AUDIO_SIZE // (1024*1024),
                "max_file_upload": "50MB"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete transcription task"""
    if task_id not in transcription_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    del transcription_tasks[task_id]
    
    return {"status": "deleted", "task_id": task_id}

# ==================== UTILITY ENDPOINTS ====================

@app.get("/api/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Get system statistics"""
    try:
        # Meeting statistics
        total_meetings = db.query(Meeting).count()
        meetings_by_status = db.query(Meeting.status, db.func.count(Meeting.id)).group_by(Meeting.status).all()
        
        # Transcription statistics
        with_transcription = db.query(Meeting).filter(Meeting.transcription_id.isnot(None)).count()
        with_audio = db.query(Meeting).filter(Meeting.audio_file_path.isnot(None)).count()
        
        # Recent activity
        recent_meetings = db.query(Meeting).order_by(Meeting.created_at.desc()).limit(5).all()
        
        return {
            "meetings": {
                "total": total_meetings,
                "by_status": dict(meetings_by_status),
                "with_transcription": with_transcription,
                "with_audio": with_audio
            },
            "system": {
                "transcription_tasks": len(transcription_tasks),
                "cached_models": len(model_cache),
                "temp_files": len(list(UPLOAD_DIR.glob("*"))) if UPLOAD_DIR.exists() else 0
            },
            "recent_activity": [
                {
                    "id": m.id,
                    "title": m.title,
                    "created_at": m.created_at.isoformat(),
                    "status": m.status
                }
                for m in recent_meetings
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve statistics")

@app.get("/api/search")
async def search_meetings(
    query: str = Query(..., min_length=2),
    db: Session = Depends(get_db)
):
    """Search meetings by title, description, or organizer"""
    try:
        search_pattern = f"%{query}%"
        
        meetings = db.query(Meeting).filter(
            or_(
                Meeting.title.ilike(search_pattern),
                Meeting.description.ilike(search_pattern),
                Meeting.organizer.ilike(search_pattern),
                Meeting.location.ilike(search_pattern)
            )
        ).order_by(Meeting.start_time.desc()).limit(20).all()
        
        return [
            {
                "id": m.id,
                "title": m.title,
                "description": m.description,
                "organizer": m.organizer,
                "start_time": m.start_time.isoformat() if m.start_time else None,
                "status": m.status,
                "has_audio": bool(m.audio_file_path),
                "has_transcription": bool(m.transcription_id)
            }
            for m in meetings
        ]
        
    except Exception as e:
        logger.error(f"❌ Search error: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

# ==================== MAIN ENTRY POINT ====================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    logger.info(f"🚀 Starting Whisper Pro API on {host}:{port}")
    logger.info(f"📁 Data directory: {Path('data').absolute()}")
    logger.info(f"📁 Static directory: {Path('static').absolute()}")
    
    uvicorn.run("app:app", host=host, port=port, reload=True)