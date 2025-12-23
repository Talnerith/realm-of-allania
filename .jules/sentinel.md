## 2025-05-18 - [Fix: Wiki Integrity & Audit Trail]
**Vulnerability:** Publicly editable Wiki pages lacked verified authorship tracking. A user could spoof the `updatedBy` field or claim to be the creator of a new page.
**Learning:** In a "Wiki" model (anyone can edit), security shifts from "Ownership" to "Integrity" and "Accountability". We must ensure we know *who* made the change (`lastEditorId`) and prevent them from altering the history (`creatorId`).
**Prevention:** Enforce `lastEditorId == auth.uid` on all writes. Enforce `creatorId` immutability on updates using `!affectedKeys().hasAny(['creatorId'])`.
