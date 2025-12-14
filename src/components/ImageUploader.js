import { useState, useRef, useEffect } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon, Loader, Move } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';

export default function ImageUploader({ 
  initialUrl = '', 
  initialPosition = 'center', // e.g. "50% 50%"
  onImageChanged, // returns { url, position }
  folder = 'uploads',
  shape = 'square' // 'square' | 'banner'
}) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'url'
  const [previewUrl, setPreviewUrl] = useState(initialUrl);
  const [position, setPosition] = useState(initialPosition);
  const [isUploading, setIsUploading] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const fileInputRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    setPreviewUrl(initialUrl);
    setPosition(initialPosition || 'center');
  }, [initialUrl, initialPosition]);

  // Handle File Selection & Resize
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Resize Image (Client-side optimization)
      const resizedBlob = await resizeImage(file, 1200); // Max width 1200px
      
      // 2. Upload to Firebase
      const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const storageRef = ref(storage, `artifacts/${APP_ID}/public/${folder}/${filename}`);
      
      await uploadBytes(storageRef, resizedBlob);
      const url = await getDownloadURL(storageRef);
      
      setPreviewUrl(url);
      onImageChanged(url, position);
      setMode('preview');
    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlChange = (e) => {
    setPreviewUrl(e.target.value);
    onImageChanged(e.target.value, position);
  };

  // --- Drag to Position Logic ---
  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragStart({ x: e.clientX, y: e.clientY, initialPos: parsePosition(position) });
  };

  const handleMouseMove = (e) => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // Convert px delta to percentage roughly based on container size (approx 200px for sensitivity)
    const sensitivity = 0.5; 
    let newX = dragStart.initialPos.x - (dx * sensitivity);
    let newY = dragStart.initialPos.y - (dy * sensitivity);

    // Clamp 0-100
    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));

    const newPosString = `${newX.toFixed(0)}% ${newY.toFixed(0)}%`;
    setPosition(newPosString);
  };

  const handleMouseUp = () => {
    if (dragStart) {
        onImageChanged(previewUrl, position);
        setDragStart(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-4 text-sm border-b border-slate-700 pb-2">
         <button onClick={() => setMode('upload')} className={`${mode === 'upload' ? 'text-amber-500 font-bold' : 'text-slate-500 hover:text-slate-300'}`}>Upload File</button>
         <button onClick={() => setMode('url')} className={`${mode === 'url' ? 'text-amber-500 font-bold' : 'text-slate-500 hover:text-slate-300'}`}>Image URL</button>
      </div>

      {/* Inputs */}
      <div className="min-h-[60px]">
        {mode === 'upload' && (
            <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-amber-500 hover:bg-slate-900 rounded-lg p-4 cursor-pointer flex flex-col items-center justify-center text-slate-500 gap-2 transition-colors"
            >
                {isUploading ? <Loader className="w-5 h-5 animate-spin text-amber-500"/> : <Upload className="w-5 h-5"/>}
                <span className="text-xs">{isUploading ? 'Compressing & Uploading...' : 'Click to select image (Max 1200px)'}</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
            </div>
        )}

        {mode === 'url' && (
            <div className="flex gap-2 items-center">
                <LinkIcon className="w-4 h-4 text-slate-500"/>
                <input 
                    className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:border-amber-500 outline-none"
                    placeholder="https://example.com/image.jpg"
                    value={previewUrl}
                    onChange={handleUrlChange}
                />
            </div>
        )}
      </div>

      {/* Preview & Positioner */}
      {previewUrl && (
          <div className="space-y-2 animate-in fade-in">
              <div className="flex justify-between items-center text-xs text-amber-500 font-bold uppercase tracking-wider">
                  <span>Preview</span>
                  <span className="flex items-center gap-1 text-slate-500 font-normal normal-case"><Move className="w-3 h-3"/> Drag image to position</span>
              </div>
              
              <div 
                 className={`relative overflow-hidden bg-slate-800 border-2 border-amber-500/30 cursor-move rounded-lg group ${shape === 'banner' ? 'aspect-video w-full' : 'w-32 h-32 mx-auto rounded-full'}`}
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}
              >
                  <img 
                    ref={previewRef}
                    src={previewUrl} 
                    className="w-full h-full object-cover pointer-events-none select-none transition-none"
                    style={{ objectPosition: position }}
                    alt="Preview"
                  />
                  {/* Grid Overlay for alignment help */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-0 group-hover:opacity-20 pointer-events-none">
                      {[...Array(9)].map((_,i) => <div key={i} className="border border-white/50"></div>)}
                  </div>
              </div>
              <div className="text-center text-[10px] text-slate-600 font-mono">Position: {position}</div>
          </div>
      )}
    </div>
  );
}

// Helper: Resize Image
function resizeImage(file, maxWidth) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
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
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.85); // 85% quality JPEG
            };
        };
    });
}

// Helper: Parse position string "50% 50%"
function parsePosition(posString) {
    if (!posString) return { x: 50, y: 50 };
    const parts = posString.split(' ');
    return {
        x: parseFloat(parts[0]) || 50,
        y: parseFloat(parts[1]) || 50
    };
}