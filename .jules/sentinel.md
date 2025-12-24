## 2025-05-18 - [Fix: Wiki Integrity & Audit Trail]
**Vulnerability:** Publicly editable Wiki pages lacked verified authorship tracking. A user could spoof the `updatedBy` field or claim to be the creator of a new page.
**Learning:** In a "Wiki" model (anyone can edit), security shifts from "Ownership" to "Integrity" and "Accountability". We must ensure we know *who* made the change (`lastEditorId`) and prevent them from altering the history (`creatorId`).
**Prevention:** Enforce `lastEditorId == auth.uid` on all writes. Enforce `creatorId` immutability on updates using `!affectedKeys().hasAny(['creatorId'])`.

## 2025-05-19 - [Fix: Author Spoofing in Posts & Threads]
**Vulnerability:** Firestore rules allowed users to create `threads` and `posts` while attributing them to other users (spoofing `userId` or `creatorId`).
**Learning:** `isSignedIn()` merely checks if a user is logged in. It does NOT guarantee that the user is who they claim to be in the document payload. Always cross-check `request.resource.data.userId` against `request.auth.uid`.
**Prevention:** Added `request.resource.data.userId == request.auth.uid` (or `creatorId`) to all create rules.
