from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException, Query, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, ConfigDict
# `ValidationInfo` location can vary between pydantic releases; try fallbacks
try:
    from pydantic.functional_validators import ValidationInfo
except Exception:
    try:
        from pydantic import ValidationInfo
    except Exception:
        from typing import Any
        ValidationInfo = Any
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
from faster_whisper import WhisperModel, BatchedInferencePipeline
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words
from concurrent.futures import ThreadPoolExecutor
import nltk

# --- Import từ database và models ---
from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import Meeting

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("whisper-api")

# Tải dữ liệu NLTK (chỉ cần một lần)
try:
    nltk.download('punkt', quiet=True)
except:
    pass

# ==================== APP INITIALIZATION ====================

app = FastAPI(
    title="Whisper Transcription API with Meeting Management",
    description="High-performance speech-to-text API with integrated meeting management",
    version="2.0.0",
)


@app.on_event("startup")
async def preload_default_model():
    """Schedule model preload in background so startup isn't blocked.
    Uses `PRELOAD_MODEL` env var to choose model size (default: large-v3).
    """
    try:
        model_size = os.environ.get("PRELOAD_MODEL", "large-v3")
        logger.info(f"Scheduling background preload for model: {model_size}")

        default_options = TranscriptionOptions(model_size=model_size)

        # Schedule model loading in background thread so server can start immediately
        async def _bg_load():
            try:
                logger.info("Background model preload started...")
                await asyncio.to_thread(get_or_load_model, default_options)
                logger.info("Background model preload complete.")
            except Exception as e:
                logger.error(f"Background model preload failed: {e}")

        asyncio.create_task(_bg_load())

    except Exception as e:
        logger.error(f"Model preload scheduling failed: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tạo các thư mục cần thiết
os.makedirs("static", exist_ok=True)
os.makedirs("templates", exist_ok=True)
os.makedirs("data", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

# ==================== TEMP FILE CONFIG ====================

UPLOAD_DIR = Path(tempfile.gettempdir()) / "whisper_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ==================== TẠO DATABASE TABLES ====================

Base.metadata.create_all(bind=engine)

# ==================== DATA STORES ====================

transcription_tasks = {}
model_cache = {}
executor = ThreadPoolExecutor(max_workers=4)

# ==================== PYDANTIC MODELS ====================

# Meeting Models
class MeetingStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Participant(BaseModel):
    name: str = Field(..., min_length=1, description="Tên người tham dự")
    email: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_required: bool = True

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
    def validate_time_range(cls, v: datetime, info: ValidationInfo) -> datetime:
        """Validate that end_time is after start_time"""
        start_time = info.data.get('start_time')
        if start_time and v <= start_time:
            raise ValueError('Thời gian kết thúc phải sau thời gian bắt đầu')
        return v

class MeetingCreate(MeetingBase):
    participants: List[Participant] = []

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[MeetingStatus] = None
    participants: Optional[List[Participant]] = None
    tags: Optional[List[str]] = None

class MeetingInDB(MeetingBase):
    id: str
    participants: List[Participant] = []
    created_at: datetime
    updated_at: datetime
    audio_file_path: Optional[str] = None
    transcription_id: Optional[str] = None
    summary: Optional[str] = None
    
    # Cấu hình Pydantic V2
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True
    )

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

# ==================== MEETING MANAGEMENT ENDPOINTS ====================

@app.post("/api/meetings", response_model=MeetingInDB)
async def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    """Tạo cuộc họp mới"""
    meeting_id = str(uuid.uuid4())
    now = datetime.now()
    
    # Create meeting in database
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
    
    # Xử lý tags
    if meeting.tags:
        db_meeting.set_tags_list(meeting.tags)
    
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    
    logger.info(f"Created meeting: {meeting_id} - {meeting.title}")
    
    # Return response
    return MeetingInDB(
        id=meeting_id,
        title=meeting.title,
        description=meeting.description,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        location_type=meeting.location_type,
        location=meeting.location,
        organizer=meeting.organizer,
        status=meeting.status,
        tags=meeting.tags,
        participants=meeting.participants,
        created_at=now,
        updated_at=now
    )

@app.get("/api/meetings/{meeting_id}", response_model=MeetingInDB)
async def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Lấy thông tin một cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    # Convert back to MeetingInDB format
    return MeetingInDB(
        id=meeting.id,
        title=meeting.title,
        description=meeting.description,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        location_type=meeting.location_type,
        location=meeting.location,
        organizer=meeting.organizer,
        status=MeetingStatus(meeting.status),
        tags=meeting.get_tags_list(),
        participants=[],  # Participants stored separately if needed
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        audio_file_path=meeting.audio_file_path,
        transcription_id=meeting.transcription_id,
        summary=meeting.summary
    )

@app.get("/api/meetings", response_model=List[MeetingInDB])
async def list_meetings(
    status: Optional[MeetingStatus] = None,
    organizer: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Lấy danh sách cuộc họp với bộ lọc"""
    query = db.query(Meeting)
    
    if status:
        query = query.filter(Meeting.status == status.value)
    if organizer:
        query = query.filter(Meeting.organizer == organizer)
    if start_date:
        query = query.filter(Meeting.start_time >= start_date)
    if end_date:
        query = query.filter(Meeting.end_time <= end_date)
    
    # Sort by start time (newest first)
    meetings = query.order_by(Meeting.start_time.desc()).limit(limit).all()
    
    # Convert to MeetingInDB
    result = []
    for meeting in meetings:
        result.append(MeetingInDB(
            id=meeting.id,
            title=meeting.title,
            description=meeting.description,
            start_time=meeting.start_time,
            end_time=meeting.end_time,
            location_type=meeting.location_type,
            location=meeting.location,
            organizer=meeting.organizer,
            status=MeetingStatus(meeting.status),
            tags=meeting.get_tags_list(),
            participants=[],  # Participants stored separately if needed
            created_at=meeting.created_at,
            updated_at=meeting.updated_at,
            audio_file_path=meeting.audio_file_path,
            transcription_id=meeting.transcription_id,
            summary=meeting.summary
        ))
    
    return result

@app.put("/api/meetings/{meeting_id}", response_model=MeetingInDB)
async def update_meeting(
    meeting_id: str,
    meeting_update: MeetingUpdate,
    db: Session = Depends(get_db)
):
    """Cập nhật thông tin cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    # Update fields
    update_data = meeting_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "status" and value:
            setattr(meeting, field, value.value)
        elif field == "tags" and value:
            meeting.set_tags_list(value)
        elif value is not None:
            setattr(meeting, field, value)
    
    meeting.updated_at = datetime.now()
    db.commit()
    db.refresh(meeting)
    
    logger.info(f"Updated meeting: {meeting_id}")
    
    return MeetingInDB(
        id=meeting.id,
        title=meeting.title,
        description=meeting.description,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        location_type=meeting.location_type,
        location=meeting.location,
        organizer=meeting.organizer,
        status=MeetingStatus(meeting.status),
        tags=meeting.get_tags_list(),
        participants=[],  # Participants stored separately if needed
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        audio_file_path=meeting.audio_file_path,
        transcription_id=meeting.transcription_id,
        summary=meeting.summary
    )

@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Xóa cuộc họp"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    db.delete(meeting)
    db.commit()
    
    logger.info(f"Deleted meeting: {meeting_id}")
    return {"message": "Đã xóa cuộc họp thành công", "meeting_id": meeting_id}

@app.get("/api/meetings/calendar")
async def get_calendar_events(
    start: datetime = Query(..., description="Ngày bắt đầu (ISO format)"),
    end: datetime = Query(..., description="Ngày kết thúc (ISO format)"),
    db: Session = Depends(get_db)
):
    """Lấy sự kiện cho calendar view (tương thích FullCalendar)"""
    events = []
    
    # Query meetings within date range
    meetings = db.query(Meeting).filter(
        Meeting.start_time >= start,
        Meeting.end_time <= end
    ).all()
    
    for meeting in meetings:
        status_colors = {
            "draft": "#6B7280",
            "scheduled": "#3B82F6",
            "in_progress": "#F59E0B",
            "completed": "#10B981",
            "cancelled": "#EF4444",
        }
        
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
            }
        })
    
    return events

@app.post("/api/meetings/{meeting_id}/process-recording")
async def process_meeting_recording(
    meeting_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """
    Upload ghi âm cuộc họp và tự động xử lý:
    1. Phiên âm bằng Whisper
    2. Tạo tóm tắt
    3. Lưu kết quả vào thông tin cuộc họp
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    # Save temporary file
    file_path = UPLOAD_DIR / f"meeting_{meeting_id}_{uuid.uuid4().hex}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update meeting info
    meeting.audio_file_path = str(file_path)
    meeting.updated_at = datetime.now()
    db.commit()
    
    # Start background processing
    background_tasks.add_task(
        process_meeting_audio,
        meeting_id=meeting_id,
        file_path=str(file_path)
    )
    
    logger.info(f"Started processing recording for meeting: {meeting_id}")
    return {
        "message": "File ghi âm đã được upload và đang xử lý",
        "meeting_id": meeting_id,
        "file_path": str(file_path)
    }

async def process_meeting_audio(meeting_id: str, file_path: str):
    """Xử lý audio cuộc họp: phiên âm và tóm tắt"""
    db = next(get_db())
    try:
        logger.info(f"Processing audio for meeting {meeting_id}: {file_path}")
        
        # 1. Transcribe using Whisper
        try:
            # Tạo options cho transcription
            options = TranscriptionOptions(
                model_size="base",
                device="cpu",
                compute_type="int8",
                language="vi",
                word_timestamps=False,
                vad_filter=True,
                use_batched_mode=False
            )
            
            # Get or load model
            key = f"{options.model_size}_{options.device}_{options.compute_type}"
            if key not in model_cache:
                logger.info(f"Loading model for meeting transcription: {options.model_size}")
                model = WhisperModel(
                    options.model_size,
                    device=options.device,
                    compute_type=options.compute_type,
                    download_root=os.environ.get("MODEL_DIR", None)
                )
                model_cache[key] = model
            
            model = model_cache[key]
            
            # Run transcription
            logger.info(f"Starting transcription for meeting {meeting_id}")
            segments, info = model.transcribe(
                file_path,
                beam_size=5,
                language="vi",
                vad_filter=True,
                vad_parameters={
                    "threshold": 0.5,
                    "min_speech_duration_ms": 250,
                    "min_silence_duration_ms": 2000
                }
            )
            
            # Convert to list and get transcript text
            segments_list = list(segments)
            transcript_text = " ".join([segment.text for segment in segments_list])
            
            logger.info(f"Transcription completed for meeting {meeting_id}, {len(segments_list)} segments")
            
            # 2. Create summary from transcript
            summary = await summarize_text_async(transcript_text, "vi")
            
            # 3. Update meeting info in database
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            
            if meeting:
                # Lưu transcription result vào file
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
                    "full_text": transcript_text
                }
                
                # Lưu transcription vào file
                transcription_file = Path(file_path).parent / f"transcription_{transcription_id}.json"
                with open(transcription_file, 'w', encoding='utf-8') as f:
                    json.dump(transcription_result, f, ensure_ascii=False, indent=2)
                
                meeting.transcription_id = transcription_id
                meeting.summary = summary
                meeting.status = "completed"
                meeting.updated_at = datetime.now()
                db.commit()
                
                logger.info(f"Finished processing audio for meeting {meeting_id}")
            
        except Exception as e:
            logger.error(f"Transcription error for meeting {meeting_id}: {str(e)}")
            # Update meeting status to indicate failure
            meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
            if meeting:
                meeting.status = "cancelled"
                meeting.updated_at = datetime.now()
                db.commit()
        
        # Cleanup temp file
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
                logger.info(f"Cleaned up temp file: {file_path}")
        except Exception as e:
            logger.error(f"Error removing temp file: {e}")
            
    except Exception as e:
        logger.error(f"Error processing meeting audio for {meeting_id}: {str(e)}")
    finally:
        db.close()

# ==================== TRANSCRIPTION ENDPOINTS ====================

def get_or_load_model(options: TranscriptionOptions):
    """Get or load a model based on transcription options"""
    key = f"{options.model_size}_{options.device}_{options.compute_type}"
    
    if key not in model_cache:
        logger.info(f"Loading model: {options.model_size} on {options.device} with {options.compute_type}")
        model = WhisperModel(
            options.model_size,
            device=options.device,
            compute_type=options.compute_type,
            download_root=os.environ.get("MODEL_DIR", None)
        )
        model_cache[key] = model
    
    return model_cache[key]

async def summarize_text_async(text: str, language_code: str) -> Optional[str]:
    """Runs the Sumy summarization task in a separate thread."""
    language_map = {
        "en": "english",
        "vi": "english",  # Sumy không hỗ trợ tiếng Việt nên dùng English tokenizer
        "fr": "french",
        "de": "german",
        "es": "spanish",
        "zh": "english",
        "ja": "english"
    }
    
    LANGUAGE = language_map.get(language_code, "english")
    SENTENCES_COUNT = 3
    
    loop = asyncio.get_event_loop()
    
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
            logger.error(f"Error during Sumy summarization: {e}")
            return f"Lỗi tóm tắt: {str(e)}"

    summary = await loop.run_in_executor(executor, sumy_task, text)
    return summary

async def process_transcription(task_id: str, file_path: str, options: TranscriptionOptions):
    """Process transcription in background"""
    try:
        transcription_tasks[task_id]["status"] = "processing"
        
        # Get or load the model
        model = get_or_load_model(options)
        
        # Prepare transcription kwargs
        kwargs = {
            "beam_size": options.beam_size,
            "word_timestamps": options.word_timestamps,
            "vad_filter": options.vad_filter,
            "condition_on_previous_text": options.condition_on_previous_text,
        }
        
        # Add language if specified
        if options.language:
            kwargs["language"] = options.language
            
        # Add VAD parameters if specified
        if options.vad_parameters:
            kwargs["vad_parameters"] = options.vad_parameters
            
        # Do not pass `batch_size` directly to WhisperModel.transcribe()
        # (the upstream faster-whisper WhisperModel.transcribe doesn't accept it).
        # If batched inference is required, a separate BatchedInferencePipeline should be used.
        # Here we simply avoid passing `batch_size` to prevent TypeError.
        
        # Run transcription
        start_time = datetime.now()
        # Ensure batch_size is not in kwargs
        if 'batch_size' in kwargs:
            del kwargs['batch_size']

        segments, info = model.transcribe(file_path, **kwargs)
        
        # Convert generator to list to complete transcription
        segments_list = list(segments)
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Convert segments to JSON-compatible format
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
            
            # Add word timestamps if requested
            if options.word_timestamps and hasattr(segment, 'words'):
                segment_data["words"] = [
                    {"word": word.word, "start": word.start, "end": word.end, "probability": word.probability}
                    for word in segment.words
                ]
                
            segments_data.append(segment_data)
        
        # Store result
        result = {
            "segments": segments_data,
            "language": info.language,
            "language_probability": info.language_probability,
            "processing_time": processing_time,
            "audio_duration": segments_list[-1].end if segments_list else 0,
        }
        
        transcription_tasks[task_id]["status"] = "completed"
        transcription_tasks[task_id]["result"] = result
        
        logger.info(f"Transcription completed for task {task_id}")
        
    except Exception as e:
        logger.exception(f"Error processing transcription: {str(e)}")
        transcription_tasks[task_id]["status"] = "failed"
        transcription_tasks[task_id]["error"] = str(e)
    finally:
        # Remove temporary file
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
        except Exception as e:
            logger.error(f"Error removing temporary file: {str(e)}")

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
    """Parse form fields into TranscriptionOptions"""
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

@app.get("/")
async def read_root():
    """Serve the main HTML page"""
    try:
        # Tạo file index.html mẫu nếu không tồn tại
        if not os.path.exists("templates/index.html"):
            os.makedirs("templates", exist_ok=True)
            with open("templates/index.html", "w", encoding="utf-8") as f:
                f.write("""<!DOCTYPE html>
<html>
<head>
    <title>Whisper Transcription API</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h1>Whisper Transcription API with Meeting Management</h1>
    <p>API đang chạy. Sử dụng các endpoint để tương tác.</p>
    <ul>
        <li><a href="/docs">API Documentation (Swagger UI)</a></li>
        <li><a href="/redoc">API Documentation (ReDoc)</a></li>
        <li><a href="/api/health">Health Check</a></li>
    </ul>
</body>
</html>""")
        
        with open("templates/index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error(f"Error loading template: {e}")
        return HTMLResponse(content=f"<h1>Error: {str(e)}</h1>", status_code=500)

@app.post("/api/transcribe", response_model=TranscriptionTask)
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    options: TranscriptionOptions = Depends(parse_form_options)
):
    """
    Transcribe audio file using faster-whisper
    """
    logger.info(f"Received transcription request with options: {options}")
    
    task_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{task_id}_{file.filename}"
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
    
    task = {
        "id": task_id,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "file_name": file.filename,
    }
    
    transcription_tasks[task_id] = task
    
    background_tasks.add_task(
        process_transcription,
        task_id=task_id,
        file_path=str(file_path),
        options=options
    )
    
    return JSONResponse(status_code=202, content=task)

@app.post("/api/summarize")
async def summarize_text_api(data: Dict[str, str]):
    """
    Nhận văn bản thô và mã ngôn ngữ từ frontend để tạo bản tóm tắt.
    """
    raw_text = data.get("full_transcript")
    language_code = data.get("language_code", "en")
    
    if not raw_text:
        raise HTTPException(status_code=400, detail="Missing full_transcript in request body.")
        
    word_count = len(raw_text.split())
    if word_count < 30:
        return {"summary": "Văn bản quá ngắn để tóm tắt hiệu quả."}

    try:
        summary = await summarize_text_async(raw_text, language_code)
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Summarization API error: {e}")
        return {"summary": f"Lỗi trong quá trình tóm tắt: {str(e)}"}

@app.get("/api/tasks/{task_id}", response_model=TranscriptionTask)
async def get_task(task_id: str):
    """
    Get the status of a transcription task
    """
    if task_id not in transcription_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return transcription_tasks[task_id]

@app.get("/api/tasks", response_model=List[TranscriptionTask])
async def list_tasks(limit: int = 10, status: Optional[str] = None):
    """
    List transcription tasks
    """
    tasks = list(transcription_tasks.values())
    
    if status:
        tasks = [task for task in tasks if task["status"] == status]
    
    tasks.sort(key=lambda x: x["created_at"], reverse=True)
    
    return tasks[:limit]

@app.get("/api/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    """
    try:
        # Check database connection
        db.execute("SELECT 1")
        db_status = "connected"
        
        # Count meetings
        meetings_count = db.query(Meeting).count()
        
    except Exception as e:
        db_status = f"error: {str(e)}"
        meetings_count = 0
    
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "database": db_status,
        "meetings_count": meetings_count,
        "transcription_tasks": len(transcription_tasks),
        "model_cache_size": len(model_cache)
    }

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """
    Delete a transcription task
    """
    if task_id not in transcription_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    del transcription_tasks[task_id]
    
    return {"status": "deleted", "task_id": task_id}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    uvicorn.run("app:app", host=host, port=port, reload=True)