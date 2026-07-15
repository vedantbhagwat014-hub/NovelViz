# backend/parser.py
import fitz  # PyMuPDF
import re
from typing import List, Dict, Any

def extract_chapter_boundaries(pdf_path: str) -> List[Dict[str, Any]]:
    doc = fitz.open(pdf_path)
    total_pages = doc.page_count
    detected_chapters = []
    
    # Matches common structural chapter declarations (e.g., "Chapter One", "CHAPTER 5", "Chapter IX")
    chapter_regex = re.compile(
        r'^\s*(chapter|chap\.|book|act|section)\s+([0-9a-zA-Z\-\u2014]+)', 
        re.IGNORECASE
    )

    for page_idx in range(total_pages):
        page = doc.load_page(page_idx)
        # Extract individual text blocks to isolate structural titles from paragraphs
        text_blocks = page.get_text("blocks")
        
        for block in text_blocks:
            block_text = block[4].strip()
            lines = block_text.split('\n')
            if not lines:
                continue
                
            first_line = lines[0].strip()
            match = chapter_regex.match(first_line)
            
            if match:
                chapter_label = match.group(0)
                # Attempt to extract a subtitle if present in the text block lines
                chapter_title = lines[1].strip() if len(lines) > 1 else chapter_label
                
                detected_chapters.append({
                    "chapter_number": len(detected_chapters) + 1,
                    "chapter_title": chapter_title,
                    "start_page": page_idx + 1  # Standardizing to 1-based page indexing
                })
                break  # Stop processing blocks on this page once a structural boundary is logged

    # If no explicit markers are found, treat the entire document as a single structural block
    if not detected_chapters:
        return [{"chapter_number": 1, "chapter_title": "Full Text", "start_page": 1, "end_page": total_pages}]

    # Compute trailing end page bounds based on successive start positions
    for i in range(len(detected_chapters) - 1):
        detected_chapters[i]["end_page"] = detected_chapters[i + 1]["start_page"] - 1
    detected_chapters[-1]["end_page"] = total_pages

    return detected_chapters