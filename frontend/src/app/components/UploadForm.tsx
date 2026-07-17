'use client';

import { useState } from 'react';

interface Chapter {
  chapter_number: number;
  chapter_title: string;
  start_page: number;
  end_page: number;
}

interface UploadResponse {
  book_id: number;
  title: string;
  chapters: Chapter[];
}

export default function UploadForm({ onUploadSuccess }: { onUploadSuccess: (data: UploadResponse, file: File) => void }) {  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/books/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload and parse the novel.');
      }

      const data: UploadResponse = await response.json();
      onUploadSuccess(data, file);
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4 text-white">Upload Your Novel</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 text-center cursor-pointer hover:border-zinc-500 transition-colors relative">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <p className="text-zinc-400">
            {file ? file.name : "Drag & drop your novel PDF here, or click to browse"}
          </p>
        </div>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <button
          type="submit"
          disabled={!file || loading}
          className="w-full bg-white text-black font-semibold py-2 px-4 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing Layout...' : 'Upload & Analyze Chapters'}
        </button>
      </form>
    </div>
  );
}