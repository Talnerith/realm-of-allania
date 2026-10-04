// In-memory sample store behind the Firestore stand-in. Keys are collection
// paths ("artifacts/realm-of-allania-v2/public/data/threads"), values map
// document ids to data. AllaniaProvider swaps it via setStore().
import { SAMPLE_DATA } from './sample-data.js';

let store = SAMPLE_DATA;
const listeners = new Set();

export const getStore = () => store;

export function setStore(next) {
  if (next === store) return;
  store = next;
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
