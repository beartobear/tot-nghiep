# models.py - Định nghĩa models
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
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
    tags = Column(String(255))  # Lưu dưới dạng JSON string
    audio_file_path = Column(String(500))
    transcription_id = Column(String(100))
    summary = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def get_tags_list(self):
        """Chuyển đổi tags từ string sang list"""
        if self.tags:
            try:
                return json.loads(self.tags)
            except:
                return []
        return []
    
    def set_tags_list(self, tags_list):
        """Chuyển đổi tags từ list sang string"""
        if tags_list:
            self.tags = json.dumps(tags_list)
        else:
            self.tags = None