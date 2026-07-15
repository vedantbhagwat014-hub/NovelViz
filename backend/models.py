# backend/models.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    storage_url = Column(Text, nullable=False)  # Path to local disk or cloud bucket storage

    chapters = relationship("ChapterMapping", back_populates="book", cascade="all, delete-orphan")

class ChapterMapping(Base):
    __tablename__ = "chapter_mappings"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    chapter_number = Column(Integer, nullable=False)
    chapter_title = Column(String(255), nullable=True)
    start_page = Column(Integer, nullable=False)
    end_page = Column(Integer, nullable=False)

    scene_prompt = Column(String, nullable=True)
    
    illustration_url = Column(Text, nullable=True)
    visual_summary = Column(Text, nullable=True)

    book = relationship("Book", back_populates="chapters")