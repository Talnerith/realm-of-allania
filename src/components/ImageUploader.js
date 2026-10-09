import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Link as LinkIcon, Move, Loader, AlertCircle } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';
import { importImageFromUrl, hostedImageUrl } from '@/lib/imageUrls';

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
    // Once the parent shows something else (e.g. the image was added to a
    // gallery and the uploader cleared), our last upload is theirs to keep
    setLastUploadedUrl(prev => (prev === initialUrl ? prev : null));
  }, [initialUrl, initialPosition]);

  // Shows a freshly stored image and hands it to the parent. The upload it
  // replaces was never saved anywhere, so it's deleted, but only after the
  // parent has taken the new one (some parents save on change). Cleanup
  // failures never block the new image.
  const adoptImage = useCallback(async (url) => {
    const replaced = lastUploadedUrl;
    setLastUploadedUrl(url); // Mark this as the one to delete if they replace it again
    setPreviewUrl(url);
    setMode('preview');
    await onImageChanged(url, position);
    if (!replaced || replaced === url) return;
    try {
      await deleteObject(ref(storage, replaced));
    } catch (delErr) {
      console.warn("Failed to clean up intermediate file (might be already gone or permission issue):", delErr);
    }
  }, [lastUploadedUrl, onImageChanged, position]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!user) {
      alert("You must be logged in to upload images.");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Read the new file first, so an unreadable one leaves the current image alone
      const image = await prepareImage(file);

      // 2. Upload New
      // SECURITY UPDATE: We now nest uploads under the user's ID
      const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${image.ext}`;
      const storageRef = ref(storage, `artifacts/${APP_ID}/public/${folder}/${user.uid}/${filename}`);

      await uploadBytes(storageRef, image.blob, { contentType: image.type });
      const url = await getDownloadURL(storageRef);

      // 3. Show it, hand it over, and clean up the upload it replaces
      await adoptImage(url);
    } catch (err) {
      if (err.code === UNSUPPORTED_IMAGE) {
        alert(unsupportedFormatMessage(file));
      } else if (err.code === CANVAS_BLOCKED) {
        alert(CANVAS_BLOCKED_MESSAGE);
      } else {
        console.error("Upload failed", err);
        alert(err.code === 'storage/unauthorized'
          ? "Permission denied. You may not have access to upload here."
          : "Upload failed. Please try again.");
      }
    } finally {
      setIsUploading(false);
    }
  }, [user, adoptImage, folder]);

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
      setUrlInput('');
      await adoptImage(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [urlInput, user, adoptImage, folder]);

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
        <button type="button" onClick={() => setMode('upload')} className={`${mode === 'upload' ? 'text-gold-500 font-bold' : 'text-ink-500 hover:text-ink-300'}`}>Upload File</button>
        <button type="button" onClick={() => setMode('url')} className={`${mode === 'url' ? 'text-gold-500 font-bold' : 'text-ink-500 hover:text-ink-300'}`}>Image URL</button>
      </div>

      <div className="min-h-[60px]">
        {mode === 'upload' && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full border-2 border-dashed border-ink-700 hover:border-gold-500 hover:bg-ink-900 focus-visible:border-gold-500 focus:outline-none rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center text-ink-500 gap-2 transition-colors"
            >
              {isUploading ? <Loader className="w-5 h-5 animate-spin text-gold-500" /> : <Upload className="w-5 h-5" />}
              <span className="text-xs">{isUploading ? 'Compressing & Uploading...' : 'Click to select image (Max 1600px)'}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={isUploading} tabIndex={-1} />
          </>
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

      {hostedImageUrl(previewUrl) && (
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
              src={hostedImageUrl(previewUrl)}
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

// The browser couldn't decode the file (e.g. an iPhone HEIC photo outside Safari)
const UNSUPPORTED_IMAGE = 'image/unsupported-format';

export function unsupportedFormatMessage(file) {
  const formats = 'Please choose a JPG, PNG, GIF or WebP image.';
  if (/\.(heic|heif)$/i.test(file?.name || '') || /image\/hei[cf]/i.test(file?.type || '')) {
    return `iPhone photos (HEIC) can't be opened in this browser. ${formats} A screenshot of the photo works too.`;
  }
  return `This file format isn't supported. ${formats}`;
}

// The canvas came back as one flat colour (privacy settings or extensions that
// block canvas reads, GPU glitches) and the original is too big to send as is
const CANVAS_BLOCKED = 'image/canvas-blocked';
const CANVAS_BLOCKED_MESSAGE = "Your browser wouldn't let us resize this image (often a privacy setting or extension). Please choose an image under 5 MB, or add it by link instead.";

// Formats the storage rules accept, by content type, with their file extension
const UPLOAD_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
// Supported images this small upload untouched (keeps transparency and GIF animation)
const DIRECT_UPLOAD_BYTES = 2 * 1024 * 1024;
// storage.rules caps uploads below 5 MB
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Longest side after resizing; also keeps tall images inside browser canvas limits
const MAX_SIDE = 1600;

// Returns { blob, type, ext } ready to upload
async function prepareImage(file) {
  const img = await decodeImage(file);
  const original = UPLOAD_TYPES[file.type] && { blob: file, type: file.type, ext: UPLOAD_TYPES[file.type] };
  if (original && file.size <= DIRECT_UPLOAD_BYTES) return original;

  const resized = await resizeImage(img, file.type);
  if (!resized.blank) return resized;
  // A flat-colour canvas is almost always the browser blocking the read, not the picture
  if (original && file.size < MAX_UPLOAD_BYTES) return original;
  throw Object.assign(new Error('The browser returned a blank canvas.'), { code: CANVAS_BLOCKED });
}

function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const unsupported = () => Object.assign(new Error('The selected file is not a supported image.'), { code: UNSUPPORTED_IMAGE });
    if (file.type && !file.type.startsWith('image/')) {
      reject(unsupported());
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(unsupported());
      img.onload = () => resolve(img);
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function resizeImage(img, sourceType) {
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

  // JPEG has no transparency (clear pixels turn black), so formats that may
  // have it go to WebP; browsers that can't encode WebP hand back PNG, which
  // can be too big, and then JPEG it is
  let out = await encode(canvas, sourceType === 'image/jpeg' ? 'image/jpeg' : 'image/webp');
  if (out.blob.size >= MAX_UPLOAD_BYTES && out.type !== 'image/jpeg') out = await encode(canvas, 'image/jpeg');
  return { ...out, blank: isFlatColour(canvas) };
}

function encode(canvas, outType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Image compression failed.'));
        return;
      }
      const type = UPLOAD_TYPES[blob.type] ? blob.type : outType;
      resolve({ blob, type, ext: UPLOAD_TYPES[type] });
    }, outType, 0.85);
  });
}

// Samples the canvas on a small grid; every sample the same colour means it's blank
function isFlatColour(canvas) {
  try {
    const sample = document.createElement('canvas');
    sample.width = sample.height = 16;
    const ctx = sample.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 16, 16);
    const { data } = ctx.getImageData(0, 0, 16, 16);
    for (let i = 4; i < data.length; i += 4) {
      for (let c = 0; c < 4; c++) {
        if (Math.abs(data[i + c] - data[c]) > 2) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function parsePosition(posString) {
  if (!posString) return { x: 50, y: 50 };
  const parts = posString.split(' ');
  return { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 };
}