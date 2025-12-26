# models.py - Định nghĩa models
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import json

class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(String(50), primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    location_type = Column(String(20), default="physical")
    location = Column(String(255))
    organizer = Column(String(100), nullable=False)
    status = Column(String(20), default="scheduled")
    recurrence_rule = Column(String(100))
    tags = Column(String(255), default="[]")  # Mặc định là "[]"
    
    audio_file_path = Column(String(500), nullable=True)
    audio_file_name = Column(String(255), nullable=True)
    audio_file_size = Column(Float, nullable=True)
    
    # QUAN TRỌNG: DÒNG NÀY PHẢI CÓ
    transcription_id = Column(String(100), ForeignKey("transcriptions.id"), nullable=True)
    
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    
    # Quan hệ đơn giản với Transcription
    transcription = relationship("Transcription", foreign_keys=[transcription_id], uselist=False)
    
    def get_tags_list(self):
        """Chuyển đổi tags từ string sang list"""
        if self.tags:
            try:
                return json.loads(self.tags)
            except:
                return []
        return []


class Participant(Base):
    __tablename__ = "participants"

    id = Column(String(50), primary_key=True, index=True)
    meeting_id = Column(String(50), ForeignKey("meetings.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=True)
    role = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    is_required = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

    meeting = relationship("Meeting", back_populates="participants")


class Transcription(Base):
    __tablename__ = "transcriptions"

    id = Column(String(100), primary_key=True, index=True)
    meeting_id = Column(String(50), ForeignKey("meetings.id"), nullable=True, index=True)
    file_path = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=True)
    language = Column(String(20), nullable=True)
    duration = Column(Float, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Quan hệ ngược
    meeting = relationship("Meeting", foreign_keys=[meeting_id])