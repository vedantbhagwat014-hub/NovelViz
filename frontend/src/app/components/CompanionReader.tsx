'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Chapter {
  chapter_number: number;
  chapter_title: string;
  start_page: number;
  end_page: number;
}

export default function CompanionReader({ bookId, file, chapters }: { bookId: number, file: File, chapters: Chapter[] }) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // NEW: State to hold the actual PDF Document instance so we can read from it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (numPages && !initialScrollDone) {
      const savedPage = localStorage.getItem(`novelviz_progress_${bookId}`);
      const pageToScroll = savedPage ? parseInt(savedPage) : 1;

      setTimeout(() => {
        if (pageRefs.current[pageToScroll]) {
          pageRefs.current[pageToScroll]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActivePage(pageToScroll);
        }
        setInitialScrollDone(true);
      }, 500);
    }
  }, [numPages, bookId, initialScrollDone]);

  useEffect(() => {
    const observers = Object.entries(pageRefs.current).map(([pageStr, element]) => {
      if (!element) return null;
      const pageNum = parseInt(pageStr);
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            setActivePage(pageNum);
            localStorage.setItem(`novelviz_progress_${bookId}`, pageNum.toString());
          }
        },
        { threshold: [0.5] }
      );
      observer.observe(element);
      return { observer, element };
    });

    return () => {
      observers.forEach((obs) => {
        if (obs) obs.observer.unobserve(obs.element);
      });
    };
  }, [numPages, bookId]); 

 // 1. Try to find the exact chapter for this page
  let currentChapter = chapters.find(
    (ch) => activePage >= ch.start_page && activePage <= ch.end_page
  );

  // 2. FALLBACK: If the page isn't in a strict range, find the closest preceding chapter.
  if (!currentChapter && chapters.length > 0) {
    currentChapter = [...chapters].reverse().find(ch => activePage >= ch.start_page) || chapters[0];
  }

  // 3. DEBUG LOGS: Watch exactly what React sees
  console.log("Current Page:", activePage);
  console.log("PDF Loaded:", !!pdfDoc);
  console.log("Current Chapter Selected:", currentChapter);

  // FIX: Extract actual text from the PDF and send it to the AI
 // FIX: Robust Pre-fetching with Mount Checking
// FIX: Stable Fetching without Aggressive Rate Limiting
  useEffect(() => {
    if (!currentChapter || !pdfDoc) return;

    let isMounted = true; 

    const fetchAiIllustration = async (chapterToFetch: Chapter) => {
      // 1. Instantly clear the old image and show the loading spinner
      setCurrentImageUrl(null);
      setIsGenerating(true);
      
      try {
        const page = await pdfDoc.getPage(chapterToFetch.start_page);
        const textContent = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actualPageText = textContent.items.map((item: any) => item.str).join(' ');

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chapters/${chapterToFetch.chapter_number}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: actualPageText.substring(0, 1500) 
          })
        });

        const data = await response.json();
        
        // 2. Only update if the user hasn't scrolled away while we were waiting
        if (isMounted && data.image_url) {
          setCurrentImageUrl(data.image_url);
        }
      } catch (error) {
        console.error(`Failed to generate image for chapter ${chapterToFetch.chapter_number}:`, error);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    fetchAiIllustration(currentChapter);

    return () => {
      isMounted = false; 
    };
  }, [currentChapter?.chapter_number, pdfDoc]); // Removed 'chapters' array to prevent infinite re-renders

  return (
    <div className="flex h-[85vh] w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mt-6 shadow-2xl">
      
      <div className="w-2/3 h-full overflow-y-auto p-8 bg-zinc-950 flex flex-col items-center space-y-8 scroll-smooth">
        {/* FIX: Capture the `pdf` instance on load so we can extract text from it later */}
        <Document 
          file={file} 
          onLoadSuccess={(pdf) => { 
            setNumPages(pdf.numPages); 
            setPdfDoc(pdf); 
          }}
        >
          {Array.from(new Array(numPages || 0), (_, index) => (
            <div key={index + 1} ref={(el) => { pageRefs.current[index + 1] = el; }} className="shadow-lg bg-white p-2 rounded mb-8">
              <Page pageNumber={index + 1} width={600} renderAnnotationLayer={false} renderTextLayer={true} />
            </div>
          ))}
        </Document>
      </div>

      <div className="w-1/3 h-full border-l border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center relative">
        <div className="w-full h-2/3 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center relative shadow-inner">
          {isGenerating ? (
            <div className="flex flex-col items-center text-zinc-400 animate-pulse">
              <svg className="w-10 h-10 mb-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p>AI Concept Artist is drawing...</p>
            </div>
          ) : currentImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img 
              src={currentImageUrl} 
              alt="Chapter Illustration" 
              className="object-cover w-full h-full transition-opacity duration-1000 ease-in-out" 
            />
          ) : (
            <div className="flex flex-col items-center text-zinc-500">
               <svg className="w-12 h-12 mb-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
               <p>No scene loaded</p>
            </div>
          )}
        </div>

        <div className="mt-8 text-zinc-400 w-full bg-zinc-900 p-4 rounded-lg border border-zinc-800 text-left">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Current Chapter</span>
            <span className="text-xs font-mono text-zinc-500">Page {activePage}</span>
          </div>
          <p className="text-lg font-bold text-white truncate">
            {currentChapter ? currentChapter.chapter_title : 'Scanning...'}
          </p>
        </div>

      </div>
    </div>
  );
}