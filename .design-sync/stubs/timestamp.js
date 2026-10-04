// Minimal Firestore Timestamp: the components call toDate()/toMillis()
export class Timestamp {
  constructor(ms) { this.ms = ms; }
  static now() { return new Timestamp(Date.now()); }
  static fromDate(d) { return new Timestamp(d.getTime()); }
  static fromMillis(ms) { return new Timestamp(ms); }
  toDate() { return new Date(this.ms); }
  toMillis() { return this.ms; }
  get seconds() { return Math.floor(this.ms / 1000); }
}
