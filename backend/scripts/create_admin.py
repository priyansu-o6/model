import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext
from app.config import get_settings
from app.models.user import User

settings = get_settings()
engine = create_engine(settings.sync_database_url)
SessionLocal = sessionmaker(bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "admin@pratyaksha.com").first()
        if existing:
            print("User already exists")
            return
        user = User(
            email="admin@pratyaksha.com",
            hashed_password=pwd_context.hash("admin123"),
            role="admin",
            organization="Pratyaksha",
            is_active=True,
        )
        db.add(user)
        db.commit()
        print("Admin user created successfully")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()

