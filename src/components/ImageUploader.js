import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Link as LinkIcon, Move, Loader, AlertCircle } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';
import { importImageFromUrl } from '@/lib/imageUrls';

const ImageUploader = React.memo(function ImageUploader({
  initialUrl = '',
  initialPosition = 'center',
  onImageChanged,
  folder = 'uploads',
  shape = 'square' // 'square' | 'banner' | 'circle'
}) {
  const { user } = useGame();
  const [mode, setMode] = useState('upload');
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [position, setPosition] = useState(initialPosition);
  const [isUploading, setIsUploading] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  // Track the last file we uploaded in this session to clean it up if replaced
  const [lastUploadedUrl, setLastUploadedUrl] = useState(null);

  // OPTIMIZATION: Throttling for Drag Events
  // We use a timestamp to ensure we don't update state more than 30 times a second
  const lastDragUpdate = useRef(0);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setPreviewUrl(initialUrl);
    setPosition(initialPosition || 'center');
  }, [initialUrl, initialPosition]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!user) {
      alert("You must be logged in to upload images.");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Intermediate Cleanup: If we already uploaded a file in this session, delete it before uploading the new one
      if (lastUploadedUrl) {
        try {
          const oldRef = ref(storage, lastUploadedUrl);
          await deleteObject(oldRef);
          console.log("Cleaned up intermediate file:", lastUploadedUrl);
        } catch (delErr) {
          console.warn("Failed to clean up intermediate file (might be already gone or permission issue):", delErr);
        }
      }

      // 2. Upload New
      // SECURITY UPDATE: We now nest uploads under the user's ID
      const resizedBlob = await resizeImage(file, 1600);
      const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const storageRef = ref(storage, `artifacts/${APP_ID}/public/${folder}/${user.uid}/${filename}`);

      await uploadBytes(storageRef, resizedBlob);
      const url = await getDownloadURL(storageRef);

      // 3. Update State
      setLastUploadedUrl(url); // Mark this as the one to delete if they replace it again
      setPreviewUrl(url);
      onImageChanged(url, position); // Use current position
      setMode('preview');
    } catch (err) {
      console.error("Upload failed", err);
      if (err.code === 'storage/unauthorized') {
        alert("Permission denied. You may not have access to upload here.");
      } else {
        alert("Upload failed. Please try again.");
      }
    } finally {
      setIsUploading(false);
    }
  }, [user, lastUploadedUrl, folder, position, onImageChanged]);

  // Pasted links are copied into the user's Storage folder by a Cloud
  // Function (and moderated like an upload); the site only shows hosted images
  const [urlInput, setUrlInput] = useState('');
  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) return;
    if (!user) {
      alert("You must be logged in to add images.");
      return;
    }
    setIsUploading(true);
    try {
      const url = await importImageFromUrl(urlInput.trim(), folder);
      setLastUploadedUrl(url);
      setPreviewUrl(url);
      onImageChanged(url, position);
      setUrlInput('');
      setMode('preview');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [urlInput, user, folder, position, onImageChanged]);

  // --- Drag Logic (Unified Mouse & Touch) ---
  const handleStart = useCallback((clientX, clientY) => {
    setDragStart({ x: clientX, y: clientY, initialPos: parsePosition(position) });
  }, [position]);

  const handleMove = useCallback((clientX, clientY) => {
    if (!dragStart) return;

    // OPTIMIZATION: Throttle to ~30fps (33ms)
    const now = Date.now();
    if (now - lastDragUpdate.current < 30) return;
    lastDragUpdate.current = now;

    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    const sensitivity = 0.4;
    let newX = dragStart.initialPos.x - (dx * sensitivity);
    let newY = dragStart.initialPos.y - (dy * sensitivity);
    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));
    const newPosString = `${newX.toFixed(0)}% ${newY.toFixed(0)}%`;
    setPosition(newPosString);

    // NOTE: We only update local state here. 
    // We do NOT call onImageChanged repeatedly to avoid parent re-renders while dragging.
    // We call it on END.
  }, [dragStart]);

  const handleEnd = useCallback(() => {
    if (dragStart) {
      // Final update to parent when drag stops
      onImageChanged(previewUrl, position);
      setDragStart(null);
    }
  }, [dragStart, previewUrl, position, onImageChanged]);

  // Mouse Handlers
  const onMouseDown = (e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); };
  const onMouseMove = (e) => { handleMove(e.clientX, e.clientY); };
  const onMouseUp = () => handleEnd();

  // Touch Handlers
  const onTouchStart = (e) => {
    // Prevent default to stop scrolling while dragging image
    // But only if we are actually touching the image container
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchEnd = () => handleEnd();

  // Determine Container Style based on Shape
  let containerClass = "w-32 h-32 rounded-full mx-auto"; // default circle
  if (shape === 'square') containerClass = "aspect-square w-full rounded-lg";
  if (shape === 'banner') containerClass = "aspect-[3/1] w-full rounded-lg"; // 3:1 ratio for cinematic banners

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-sm border-b border-ink-700 pb-2">
        <button onClick={() => setMode('upload')} className={`${mode === 'upload' ? 'text-gold-500 font-bold' : 'text-ink-500 hover:text-ink-300'}`}>Upload File</button>
        <button onClick={() => setMode('url')} className={`${mode === 'url' ? 'text-gold-500 font-bold' : 'text-ink-500 hover:text-ink-300'}`}>Image URL</button>
      </div>

      <div className="min-h-[60px]">
        {mode === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-ink-700 hover:border-gold-500 hover:bg-ink-900 rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center text-ink-500 gap-2 transition-colors"
          >
            {isUploading ? <Loader className="w-5 h-5 animate-spin text-gold-500" /> : <Upload className="w-5 h-5" />}
            <span className="text-xs">{isUploading ? 'Compressing & Uploading...' : 'Click to select image (Max 1600px)'}</span>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
          </div>
        )}
        {mode === 'url' && (
          <div className="flex gap-2 items-center">
            <LinkIcon className="w-4 h-4 text-ink-500" />
            <input
              className="flex-1 bg-ink-950 border border-ink-700 rounded p-2 text-sm text-ink-200 focus:border-gold-500 outline-none"
              placeholder="https://example.com/image.jpg"
              aria-label="Image URL"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlImport(); } }}
              disabled={isUploading}
            />
            <button
              type="button"
              onClick={handleUrlImport}
              disabled={isUploading || !urlInput.trim()}
              className="px-3 py-2 rounded bg-gold-700 hover:bg-gold-600 disabled:opacity-50 text-white text-sm"
            >
              {isUploading ? <Loader className="w-4 h-4 animate-spin" /> : 'Add'}
            </button>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="space-y-2 animate-in fade-in">
          <div className="flex justify-between items-center text-xs text-gold-500 font-bold uppercase tracking-wider">
            <span>Preview & Focus</span>
            <span className="flex items-center gap-1 text-ink-500 font-normal normal-case"><Move className="w-3 h-3" /> Drag to set focus point</span>
          </div>

          <div
            className={`relative overflow-hidden bg-ink-800 border-2 border-gold-500/30 cursor-move group touch-none ${containerClass}`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={previewUrl}
              className="w-full h-full object-cover pointer-events-none select-none transition-none"
              style={{ objectPosition: position }}
              alt="Preview"
            />

            {/* Grid & Safe Zone Overlay */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              {/* Grid Lines */}
              {[...Array(9)].map((_, i) => <div key={i} className="border border-white/20"></div>)}

              {/* Cutoff Guides (Safe Zone) */}
              {shape === 'banner' && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-[15%] bg-black/40 border-b border-white/30 backdrop-blur-[1px]"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-[15%] bg-black/40 border-t border-white/30 backdrop-blur-[1px]"></div>
                  <div className="absolute top-2 left-2 text-2xs text-white/70 font-mono">Cutoff Area</div>
                </>
              )}
            </div>
          </div>
          <div className="text-center text-2xs text-ink-500 font-mono">Focus Position: {position}</div>
        </div>
      )}
    </div>
  );
});

export default ImageUploader;

function resizeImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('The selected file is not a valid image.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Image compression failed.')),
          'image/jpeg',
          0.85
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function parsePosition(posString) {
  if (!posString) return { x: 50, y: 50 };
  const parts = posString.split(' ');
  return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 };
}