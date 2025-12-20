# meeting_models.py
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, validator
from enum import Enum

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
    is_required: bool = True  # Bắt buộc tham dự hay không

class MeetingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="Tiêu đề cuộc họp")
    description: Optional[str] = None
    start_time: datetime = Field(..., description="Thời gian bắt đầu")
    end_time: datetime = Field(..., description="Thời gian kết thúc")
    location_type: str = Field("physical", description="physical (phòng họp) hoặc online")
    location: Optional[str] = Field(None, description="Tên phòng hoặc link online")
    organizer: str = Field(..., description="Người chủ trì/tổ chức")
    status: MeetingStatus = MeetingStatus.DRAFT
    recurrence_rule: Optional[str] = None  # Theo chuẩn iCal RRULE, ví dụ: "FREQ=WEEKLY;INTERVAL=1"
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
    audio_file_path: Optional[str] = None  # Đường dẫn file ghi âm
    transcription_id: Optional[str] = None  # ID kết quả phiên âm từ hệ thống hiện có
    summary: Optional[str] = None  # Tóm tắt cuộc họp
    
    class Config:
        allow_population_by_field_name = True