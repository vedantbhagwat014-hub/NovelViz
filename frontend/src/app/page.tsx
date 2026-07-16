'use client';

import { useState } from 'react';
import UploadForm from './components/UploadForm';
import dynamic from 'next/dynamic';

// Force Next.js to render this strictly on the client side
const CompanionReader = dynamic(() => import('./components/CompanionReader'), { 
  ssr: false,
  loading: () => <div className="text-zinc-500 mt-10 text-center animate-pulse">Loading PDF Engine...</div>
});

interface Chapter {
  chapter_number: number;
  chapter_title: string;
  start_page: number;
  end_page: number;
}

interface BookData {
  book_id: number;
  title: string;
  chapters: Chapter[];
}

export default function Home() {
  const [bookData, setBookData] = useState<BookData | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-zinc-950 text-white">
      {!bookData ? (
        <div className="flex flex-col items-center max-w-2xl text-center space-y-6 mt-20">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Welcome to <span className="text-zinc-400">NovelViz</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-md">
            Upload your novel PDF to automatically parse chapters and read with an AI visual companion.
          </p>
          <UploadForm 
            onUploadSuccess={(data: BookData, file: File) => {
              setBookData(data);
              setPdfFile(file);
            }} 
          />
        </div>
      ) : (
        <div className="w-full max-w-6xl">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-2xl font-bold">Now Reading: {bookData.title}</h2>
              <p className="text-zinc-400">Detected {bookData.chapters.length} chapters mapped to pages.</p>
            </div>
            <button 
              onClick={() => { setBookData(null); setPdfFile(null); }}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ← Upload a different book
            </button>
          </div>
          
          {/* FIX: Now passing the bookId prop down */}
          {pdfFile && <CompanionReader bookId={bookData.book_id} file={pdfFile} chapters={bookData.chapters} />}
        </div>
      )}
    </main>
  );
}