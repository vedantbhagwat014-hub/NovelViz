# backend/main.py
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import shutil
import os
import requests
import base64
from database import engine, Base, get_db
import models
import parser
import google.generativeai as genai
from dotenv import load_dotenv
from pydantic import BaseModel
import urllib.parse

# Load your secret keys from the .env file
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    print(f"DEBUG: Key length is {len(GEMINI_API_KEY)}")
    print(f"DEBUG: Key starts with {GEMINI_API_KEY[:4]}")
else:
    print("DEBUG: API Key is completely missing (None)")
# -------------------------
genai.configure(api_key=GEMINI_API_KEY)

# # Hugging Face Setup
# HF_TOKEN = os.getenv("HF_TOKEN")
# HF_API_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0"
# HF_HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

# Set up the text model (The Director)
model = genai.GenerativeModel('gemini-3.5-flash')

# Define the data shape we expect from the React frontend
class ChapterTextPayload(BaseModel):
    text: str

# Ensure local tables are initialized relative to storage engine configurations
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NovelViz Backend Engine")

# Enable Cross-Origin Resource Sharing for the Next.js local server domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "https://novel-viz-liard.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "storage")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/api/books/upload")
async def upload_novel_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only standard PDF configurations allowed.")

    # Save incoming stream file block locally
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Instantiate structural reference trace in database
    db_book = models.Book(title=file.filename.replace(".pdf", ""), storage_url=file_path)
    db.add(db_book)
    db.commit()
    db.refresh(db_book)

    # Run the structural boundary engine
    try:
        chapter_bounds = parser.extract_chapter_boundaries(file_path)

        # Insert individual parsed chapter tracks
        for ch in chapter_bounds:
            db_chapter = models.ChapterMapping(
                book_id=db_book.id,
                chapter_number=ch["chapter_number"],
                chapter_title=ch["chapter_title"],
                start_page=ch["start_page"],
                end_page=ch["end_page"]
            )
            db.add(db_chapter)

        db.commit()
    except Exception as e:
        db.delete(db_book)
        db.commit()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process document boundaries: {str(e)}")

    # Return clean JSON state to the client interface application
    db.refresh(db_book)
    return {
        "book_id": db_book.id,
        "title": db_book.title,
        "chapters": [
            {
                "chapter_number": c.chapter_number,
                "chapter_title": c.chapter_title,
                "start_page": c.start_page,
                "end_page": c.end_page
            } for c in db_book.chapters
        ]
    }

# pollinations ai

@app.post("/api/chapters/{chapter_id}/analyze")
async def analyze_chapter_scene(chapter_id: int, payload: ChapterTextPayload, db: Session = Depends(get_db)):
    # 1. Fetch from DB first using the chapter_number passed from the frontend
    # Changed filter from .id to .chapter_number to match your Next.js path parameter
    chapter = db.query(models.ChapterMapping).filter(models.ChapterMapping.chapter_number == chapter_id).first()
    
    if chapter and chapter.illustration_url:
        return {
            "chapter_id": chapter_id,
            "scene_prompt": chapter.scene_prompt,
            "image_url": chapter.illustration_url
        }

    # 2. Strict Stylistic Instructions: Focus ONLY on Setting
    ai_instructions = f"""
    Read this novel excerpt. Extract ONLY the core setting, environment, and atmosphere in one short, vivid sentence.
    Do NOT include characters, people, or specific actions. Focus purely on the architecture, landscape, and lighting.
    Example output: 'A dark oak library inside an ancient castle illuminated by a sudden brilliant flash of white lightning.'
    Do not add any art styles.
    
    Novel Excerpt:
    {payload.text}
    """
    
    # 3. Call Text AI & Generate Setting Context
    response = model.generate_content(ai_instructions)
    core_setting = response.text.strip()
    
    # 4. Enforce strict oil painting parameters and exclude human forms completely
    final_prompt = f"{core_setting}. Masterpiece, traditional digital oil painting, heavy brushstrokes, concept art, empty environment, highly atmospheric, no text, no watermark, no people, no characters."
    
    # 5. Instant Generation using Flux via URL (Zero wait time)
    encoded_prompt = urllib.parse.quote(final_prompt)
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&model=flux&nologo=true"

    # 6. Save to DB if the row mapping exists
    if chapter:
        chapter.scene_prompt = final_prompt
        chapter.illustration_url = image_url
        db.commit()
    else:
        # Fallback security check if the book wasn't parsed correctly into db
        print(f"Warning: Chapter track number {chapter_id} not found in database records.")
        
    return {"chapter_id": chapter_id, "scene_prompt": final_prompt, "image_url": image_url}

# huggingface model
# @app.post("/api/chapters/{chapter_id}/analyze")
# async def analyze_chapter_scene(chapter_id: int, payload: ChapterTextPayload, db: Session = Depends(get_db)):
#     # 1. Fetch from DB first (Check if we already generated it)
#     chapter = db.query(models.ChapterMapping).filter(models.ChapterMapping.id == chapter_id).first()
#     if chapter and chapter.illustration_url:
#         return {
#             "chapter_id": chapter_id,
#             "scene_prompt": chapter.scene_prompt,
#             "image_url": chapter.illustration_url
#         }

#     # 2. Strict Stylistic Instructions: Focus ONLY on Setting
#     ai_instructions = f"""
#     Read this novel excerpt. Extract ONLY the core setting, environment, and atmosphere in one short, vivid sentence.
#     Do NOT include characters, people, or specific actions. Focus purely on the architecture, landscape, and lighting.
    
#     Do not add any art styles.
    
#     Novel Excerpt:
#     {payload.text}
#     """
    
#     # 3. Call Text AI & Generate Setting Context
#     response = model.generate_content(ai_instructions)
#     core_setting = response.text.strip()
    
#     # 4. Enforce strict oil painting parameters and completely exclude human forms
#     final_prompt = f"{core_setting}. Masterpiece, traditional digital oil painting, heavy brushstrokes, focused composition, concept art, empty environment, highly atmospheric, no text, no watermark, no people, no characters."
    
#     # 5. Call Hugging Face API
#     if not HF_TOKEN:
#         raise HTTPException(status_code=500, detail="Hugging Face token missing from configuration (.env file)")
        
#     try:
#         hf_response = requests.post(
#             HF_API_URL, 
#             headers=HF_HEADERS, 
#             json={"inputs": final_prompt}
#         )
        
#         # If the model is sleeping, HF returns a 503 status code with a loading message
#         if hf_response.status_code == 503:
#             raise HTTPException(
#                 status_code=503, 
#                 detail="The image model is currently waking up on Hugging Face servers. Please try again in 20 seconds."
#             )
            
#         hf_response.raise_for_status()
        
#         # 6. Convert raw image bytes into a native Base64 Data URL for the React Frontend
#         image_bytes = hf_response.content
#         base64_encoded = base64.b64encode(image_bytes).decode('utf-8')
#         image_data_url = f"data:image/jpeg;base64,{base64_encoded}"
        
#     except HTTPException as http_err:
#         raise http_err
#     except Exception as e:
#         print(f"Hugging Face API Error: {e}")
#         raise HTTPException(status_code=500, detail="Failed to communicate with Hugging Face engine")

#     # 7. Save structural reference data cache to DB
#     if chapter:
#         chapter.scene_prompt = final_prompt
#         chapter.illustration_url = image_data_url
#         db.commit()
        
#     return {"chapter_id": chapter_id, "scene_prompt": final_prompt, "image_url": image_data_url}