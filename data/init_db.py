# data/init_db.py - Khởi tạo database
import sys
from pathlib import Path

# Ensure the repository root is on sys.path so `from database import ...` works
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

from database import engine, Base
from models import Meeting

def init_database():
    print("🔄 Đang tạo database...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database đã được khởi tạo!")

if __name__ == "__main__":
    init_database()