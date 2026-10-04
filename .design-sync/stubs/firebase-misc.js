// Design-sync stand-ins for '@/lib/firebase', 'firebase/storage' and
// 'firebase/functions'. The handles are truthy so components take their normal
// "connected" code paths (and read sample data); uploads/calls resolve
// harmlessly instead of reaching a real backend.
export const app = {};
export const auth = {};
export const db = {};
export const storage = {};
export const functions = {};

// firebase/storage
export const ref = (_storage, path) => ({ path });
export const uploadBytes = async () => ({});
export const getDownloadURL = async () => '';
export const deleteObject = async () => {};
export const getStorage = () => ({});

// firebase/functions
export const httpsCallable = () => async () => ({ data: {} });
export const getFunctions = () => ({});
