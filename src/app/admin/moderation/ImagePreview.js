'use client';
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Image as ImageIcon } from 'lucide-react';
import { functions } from '@/lib/firebase';

// The image behind an entry, loaded on request. Held images have no working
// link, so the previewImage function sends the file itself (as a data: URL).
export default function ImagePreview({ filePath }) {
    const [state, setState] = useState({ status: 'idle' });

    const load = async () => {
        setState({ status: 'loading' });
        try {
            const res = await httpsCallable(functions, 'previewImage')({ filePath });
            setState({ status: 'shown', src: res.data.dataUrl });
        } catch (e) {
            setState({ status: 'error', message: e.message });
        }
    };

    if (state.status === 'shown') {
        return <img src={state.src} alt="Image under review" className="max-h-80 max-w-full rounded border border-ink-800" />;
    }
    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={load}
                disabled={state.status === 'loading'}
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-ink-700 text-sm text-ink-200 hover:border-gold-600 hover:text-gold-300 disabled:opacity-60"
            >
                <ImageIcon className="w-4 h-4" aria-hidden="true" />
                {state.status === 'loading' ? 'Loading…' : 'Show image'}
            </button>
            {state.status === 'error' && <span className="text-xs text-red-400">{state.message}</span>}
        </div>
    );
}
