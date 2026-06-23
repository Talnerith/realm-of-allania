## 2025-05-18 - [Fix: Wiki Integrity & Audit Trail]
**Vulnerability:** Publicly editable Wiki pages lacked verified authorship tracking. A user could spoof the `updatedBy` field or claim to be the creator of a new page.
**Learning:** In a "Wiki" model (anyone can edit), security shifts from "Ownership" to "Integrity" and "Accountability". We must ensure we know *who* made the change (`lastEditorId`) and prevent them from altering the history (`creatorId`).
**Prevention:** Enforce `lastEditorId == auth.uid` on all writes. Enforce `creatorId` immutability on updates using `!affectedKeys().hasAny(['creatorId'])`.

## 2025-10-26 - [Fix: Firestore Insecure Creation]
**Vulnerability:** Firestore rules allowed any authenticated user to create threads, posts, and chats with arbitrary `creatorId` or `userId` fields (Identity Spoofing). Chats could be created without the creator as a participant.
**Learning:** Validation rules must explicitly check that `request.resource.data.userId` matches `request.auth.uid` during creation. Without this, client-side code provides the ID, but malicious users can bypass it to spoof posts.
**Prevention:** Added `request.resource.data.creatorId == request.auth.uid` conditions to `create` rules for threads and posts. Added `request.auth.uid in request.resource.data.participants` for chats.

## 2025-10-27 - [Fix: Update Identity Spoofing]
**Vulnerability:** Firestore rules permitted users to modify the `userId` or `creatorId` fields of their own posts and threads during an update. A user could write a post, then update it to change the author to an admin's ID, effectively spoofing them.
**Learning:** Checking ownership `request.auth.uid == resource.data.userId` permits the update, but does not inherently protect the *fields* being updated. Immutable fields (identity, timestamps) must be explicitly protected.
**Prevention:** Added `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['userId', 'creatorId', 'createdAt'])` checks to update rules.

## 2025-10-28 - [Fix: Chat Message Spoofing & Immutability]
**Vulnerability:** Chat messages in Firestore lacked `senderId` validation and immutability. A participant could spoof messages from other users by setting `senderId` to another UID, and update or modify any message in the chat history.
**Learning:** Nested subcollections (like `messages`) inherit the context of the parent (like `participants`) but must still explicitly validate the data being written. "Write" permission is too broad; explicit `create` checks and `update` denials are needed for append-only logs like chats.
**Prevention:** Split `allow read, write, delete` into granular permissions. Enforced `request.resource.data.senderId == request.auth.uid` on creation. Denied `update` entirely to ensure message history integrity.
