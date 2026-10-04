// Design-sync stand-in for 'firebase/firestore'. Claude Design renders the real
// components without a backend, so this serves reads from an in-memory sample
// store (sample-data.js, replaceable via <AllaniaProvider data={...}>) and
// accepts writes as no-ops. Only the API surface the components use exists.
import { getStore, subscribe } from '../store.js';
import { Timestamp } from './timestamp.js';

export { Timestamp };

const ref = (segments) => {
  const path = segments.filter(Boolean).map(String);
  return path.length % 2 === 0
    ? { type: 'doc', path, id: path[path.length - 1] }
    : { type: 'collection', path, id: path[path.length - 1], constraints: [] };
};
const strip = (args) => (args[0] && typeof args[0] === 'object' && !args[0].type ? args.slice(1) : args);

export function collection(parent, ...segments) {
  const base = parent?.path ?? [];
  return ref([...base, ...strip([parent, ...segments]).filter((s) => typeof s !== 'object')]);
}

let autoId = 0;
export function doc(parent, ...segments) {
  const base = parent?.path ?? [];
  const rest = strip([parent, ...segments]).filter((s) => typeof s !== 'object');
  const path = [...base, ...rest];
  if (path.length % 2 === 1) path.push(`new-${++autoId}`);
  return ref(path);
}

export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const limit = (n) => ({ kind: 'limit', n });
export const limitToLast = (n) => ({ kind: 'limitToLast', n });
export const query = (q, ...constraints) => ({ ...q, constraints: [...(q.constraints ?? []), ...constraints] });

const timeOf = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : v);

function makeDocSnap(path, data) {
  return { id: path[path.length - 1], ref: ref(path), exists: () => data != null, data: () => (data == null ? undefined : { ...data }), get: (f) => data?.[f] };
}

function runQuery(q) {
  const coll = getStore()[q.path.join('/')] ?? {};
  let rows = Object.entries(coll).map(([id, data]) => ({ id, data }));
  for (const c of q.constraints ?? []) {
    if (c.kind !== 'where') continue;
    rows = rows.filter(({ data }) => {
      const v = data[c.field];
      if (c.op === '==') return v === c.value;
      if (c.op === 'in') return c.value.includes(v);
      if (c.op === 'array-contains') return Array.isArray(v) && v.includes(c.value);
      return true;
    });
  }
  for (const c of [...(q.constraints ?? [])].reverse()) {
    if (c.kind !== 'orderBy') continue;
    rows.sort((a, b) => {
      const x = timeOf(a.data[c.field]); const y = timeOf(b.data[c.field]);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return c.dir === 'desc' ? -r : r;
    });
  }
  for (const c of q.constraints ?? []) {
    if (c.kind === 'limit') rows = rows.slice(0, c.n);
    if (c.kind === 'limitToLast') rows = rows.slice(-c.n);
  }
  const docs = rows.map(({ id, data }) => makeDocSnap([...q.path, id], data));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn), docChanges: () => [] };
}

function readDoc(r) {
  const coll = getStore()[r.path.slice(0, -1).join('/')] ?? {};
  return makeDocSnap(r.path, coll[r.id]);
}

const read = (r) => (r.type === 'doc' ? readDoc(r) : runQuery(r));

export function onSnapshot(r, next) {
  const emit = () => { try { next(read(r)); } catch (e) { console.warn('[sample data]', e); } };
  Promise.resolve().then(emit);
  return subscribe(emit);
}
export const getDoc = async (r) => readDoc(r);
export const getDocs = async (q) => runQuery(q);

// Writes are accepted and ignored: designs show the UI, not persistence
export const setDoc = async () => {};
export const updateDoc = async () => {};
export const deleteDoc = async () => {};
export const addDoc = async (c) => doc(c);
export function writeBatch() {
  const b = { set: () => b, update: () => b, delete: () => b, commit: async () => {} };
  return b;
}
export const runTransaction = async (_db, fn) => fn({ get: readDoc, set() {}, update() {}, delete() {} });

export const serverTimestamp = () => Timestamp.now();
export const increment = (n) => n;
export const arrayUnion = (...v) => v;
export const arrayRemove = () => [];
export const deleteField = () => undefined;

export const getFirestore = () => ({});
