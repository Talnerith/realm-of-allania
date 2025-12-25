## 2025-05-18 - [Fix: Wiki Integrity & Audit Trail]
**Vulnerability:** Publicly editable Wiki pages lacked verified authorship tracking. A user could spoof the `updatedBy` field or claim to be the creator of a new page.
**Learning:** In a "Wiki" model (anyone can edit), security shifts from "Ownership" to "Integrity" and "Accountability". We must ensure we know *who* made the change (`lastEditorId`) and prevent them from altering the history (`creatorId`).
**Prevention:** Enforce `lastEditorId == auth.uid` on all writes. Enforce `creatorId` immutability on updates using `!affectedKeys().hasAny(['creatorId'])`.

## 2025-10-26 - [Fix: Firestore Insecure Creation]
**Vulnerability:** Firestore rules allowed any authenticated user to create threads, posts, and chats with arbitrary `creatorId` or `userId` fields (Identity Spoofing). Chats could be created without the creator as a participant.
**Learning:** Validation rules must explicitly check that `request.resource.data.userId` matches `request.auth.uid` during creation. Without this, client-side code provides the ID, but malicious users can bypass it to spoof posts.
**Prevention:** Added `request.resource.data.creatorId == request.auth.uid` conditions to `create` rules for threads and posts. Added `request.auth.uid in request.resource.data.participants` for chats.
