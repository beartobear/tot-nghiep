from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException, Query, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, EmailStr, validator
from typing import List, Optional, Dict, Any, Annotated
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
from faster_whisper import WhisperModel, BatchedInferencePipeline
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words
from concurrent.futures import ThreadPoolExecutor
import nltk

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("whisper-api")

# Create temp directory for uploads
UPLOAD_DIR = Path(tempfile.gettempdir()) / "whisper_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ==================== MODELS FOR MEETING MANAGEMENT ====================

class MeetingStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Participant(BaseModel):
    name: str = Field(..., min_length=1, description="Tên người tham dự")
    email: Optional[EmailStr] = None
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
    
    @validator('end_time')
    def validate_time_range(cls, end_time, values):
        if 'start_time' in values and end_time <= values['start_time']:
            raise ValueError('Thời gian kết thúc phải sau thời gian bắt đầu')
        return end_time

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

class MeetingInDB(MeetingBase):
    id: str = Field(..., alias="_id")
    participants: List[Participant] = []
    created_at: datetime
    updated_at: datetime
    audio_file_path: Optional[str] = None
    transcription_id: Optional[str] = None
    summary: Optional[str] = None
    
    class Config:
        allow_population_by_field_name = True

# ==================== ORIGINAL TRANSCRIPTION MODELS ====================

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

# ==================== FASTAPI APP INITIALIZATION ====================

app = FastAPI(
    title="Whisper Transcription API with Meeting Management",
    description="High-performance speech-to-text API with integrated meeting management",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

# ==================== DATA STORES ====================

transcription_tasks = {}
model_cache = {}
meetings_db = {}  # In production, replace with real database
executor = ThreadPoolExecutor(max_workers=4)

# ==================== MEETING MANAGEMENT ENDPOINTS ====================

@app.post("/api/meetings", response_model=MeetingInDB)
async def create_meeting(meeting: MeetingCreate):
    """Tạo cuộc họp mới"""
    meeting_id = str(uuid.uuid4())
    now = datetime.now()
    
    meeting_data = MeetingInDB(
        _id=meeting_id,
        **meeting.dict(exclude={"participants"}),
        participants=meeting.participants,
        created_at=now,
        updated_at=now
    )
    
    meetings_db[meeting_id] = meeting_data.dict(by_alias=True)
    logger.info(f"Created meeting: {meeting_id} - {meeting.title}")
    return meeting_data

@app.get("/api/meetings/{meeting_id}", response_model=MeetingInDB)
async def get_meeting(meeting_id: str):
    """Lấy thông tin một cuộc họp"""
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    return meetings_db[meeting_id]

@app.get("/api/meetings", response_model=List[MeetingInDB])
async def list_meetings(
    status: Optional[MeetingStatus] = None,
    organizer: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 50
):
    """Lấy danh sách cuộc họp với bộ lọc"""
    meetings = list(meetings_db.values())
    
    if status:
        meetings = [m for m in meetings if m["status"] == status]
    if organizer:
        meetings = [m for m in meetings if m["organizer"] == organizer]
    if start_date:
        meetings = [m for m in meetings if m["start_time"] >= start_date]
    if end_date:
        meetings = [m for m in meetings if m["end_time"] <= end_date]
    
    # Sort by start time (newest first)
    meetings.sort(key=lambda x: x["start_time"], reverse=True)
    
    return meetings[:limit]

@app.put("/api/meetings/{meeting_id}", response_model=MeetingInDB)
async def update_meeting(meeting_id: str, meeting_update: MeetingUpdate):
    """Cập nhật thông tin cuộc họp"""
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    current_meeting = meetings_db[meeting_id]
    
    # Update fields
    update_data = meeting_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "participants" and value is not None:
            current_meeting[field] = value
        elif value is not None:
            current_meeting[field] = value
    
    current_meeting["updated_at"] = datetime.now()
    meetings_db[meeting_id] = current_meeting
    
    logger.info(f"Updated meeting: {meeting_id}")
    return current_meeting

@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str):
    """Xóa cuộc họp"""
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    del meetings_db[meeting_id]
    logger.info(f"Deleted meeting: {meeting_id}")
    return {"message": "Đã xóa cuộc họp thành công", "meeting_id": meeting_id}

@app.get("/api/meetings/calendar")
async def get_calendar_events(
    start: datetime = Query(..., description="Ngày bắt đầu (ISO format)"),
    end: datetime = Query(..., description="Ngày kết thúc (ISO format)")
):
    """Lấy sự kiện cho calendar view (tương thích FullCalendar)"""
    events = []
    for meeting_id, meeting in meetings_db.items():
        if start <= meeting["end_time"] and end >= meeting["start_time"]:
            status_colors = {
                "draft": "#6B7280",
                "scheduled": "#3B82F6",
                "in_progress": "#F59E0B",
                "completed": "#10B981",
                "cancelled": "#EF4444",
            }
            
            events.append({
                "id": meeting_id,
                "title": meeting["title"],
                "start": meeting["start_time"].isoformat(),
                "end": meeting["end_time"].isoformat(),
                "location": meeting.get("location", ""),
                "organizer": meeting["organizer"],
                "status": meeting["status"],
                "color": status_colors.get(meeting["status"], "#3B82F6"),
                "extendedProps": {
                    "description": meeting.get("description", ""),
                    "participants": len(meeting.get("participants", [])),
                    "location_type": meeting.get("location_type", "physical"),
                }
            })
    
    return events

@app.post("/api/meetings/{meeting_id}/process-recording")
async def process_meeting_recording(
    meeting_id: str,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Upload ghi âm cuộc họp và tự động xử lý:
    1. Phiên âm bằng Whisper
    2. Tạo tóm tắt
    3. Lưu kết quả vào thông tin cuộc họp
    """
    if meeting_id not in meetings_db:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc họp")
    
    # Save temporary file
    file_path = UPLOAD_DIR / f"meeting_{meeting_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update meeting info
    meetings_db[meeting_id]["audio_file_path"] = str(file_path)
    meetings_db[meeting_id]["updated_at"] = datetime.now()
    
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
    try:
        logger.info(f"Processing audio for meeting {meeting_id}: {file_path}")
        
        # 1. Transcribe using existing Whisper system
        with open(file_path, "rb") as f:
            files = {"file": (Path(file_path).name, f)}
            form_data = {
                "model_size": "base",
                "language": "vi",
                "word_timestamps": "false",
                "vad_filter": "true"
            }
            
            # Call internal transcription API
            response = requests.post(
                "http://localhost:8000/api/transcribe",
                files=files,
                data=form_data,
                timeout=30
            )
            
            if response.status_code == 202:
                task_id = response.json()["id"]
                
                # Wait for transcription result
                for i in range(30):  # Timeout 60s
                    await asyncio.sleep(2)
                    
                    task_resp = requests.get(
                        f"http://localhost:8000/api/tasks/{task_id}",
                        timeout=10
                    )
                    
                    if task_resp.status_code == 200:
                        task_data = task_resp.json()
                        
                        if task_data["status"] == "completed":
                            # 2. Create summary from transcript
                            transcript_text = " ".join(
                                [seg["text"] for seg in task_data["result"]["segments"]]
                            )
                            
                            # Call summarization API
                            summary_response = requests.post(
                                "http://localhost:8000/api/summarize",
                                json={
                                    "full_transcript": transcript_text,
                                    "language_code": "vi"
                                },
                                timeout=30
                            )
                            
                            summary = ""
                            if summary_response.status_code == 200:
                                summary = summary_response.json().get("summary", "")
                            
                            # 3. Update meeting info
                            meetings_db[meeting_id]["transcription_id"] = task_id
                            meetings_db[meeting_id]["summary"] = summary
                            meetings_db[meeting_id]["status"] = "completed"
                            meetings_db[meeting_id]["updated_at"] = datetime.now()
                            
                            logger.info(f"Finished processing audio for meeting {meeting_id}")
                            break
                        
                        elif task_data["status"] == "failed":
                            logger.error(f"Transcription failed for meeting {meeting_id}: {task_data.get('error')}")
                            break
                
                # Cleanup temp file
                try:
                    if os.path.exists(file_path):
                        os.unlink(file_path)
                except Exception as e:
                    logger.error(f"Error removing temp file: {e}")
                    
    except Exception as e:
        logger.error(f"Error processing meeting audio for {meeting_id}: {str(e)}")

# ==================== ORIGINAL TRANSCRIPTION ENDPOINTS ====================

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
        "vi": "english",
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
            if LANGUAGE == "english":
                parser = PlaintextParser.from_string(text_to_summarize, Tokenizer(LANGUAGE))
            else:
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
        
        # Create batched pipeline if requested
        if options.use_batched_mode:
            pipeline = BatchedInferencePipeline(
                model=model,
            )
        else:
            pipeline = model
        
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
            
        # Add batch size if using batched mode
        if options.use_batched_mode:
            kwargs["batch_size"] = options.batch_size
        
        # Run transcription
        start_time = datetime.now()
        segments, info = pipeline.transcribe(file_path, **kwargs)
        
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
        with open("templates/index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Template not found. Please check if templates/index.html exists.</h1>", status_code=404)
    except Exception as e:
        logger.error(f"Error loading template: {e}")
        return HTMLResponse(content=f"<h1>Error loading page: {str(e)}</h1>", status_code=500)

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
async def health_check():
    """
    Health check endpoint
    """
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat(),
        "meetings_count": len(meetings_db),
        "transcription_tasks": len(transcription_tasks)
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
    
@app.get("/login.html")
async def fake_login():
    return {"ERROR": "LOGIN PAGE NO LONGER EXISTS"}
