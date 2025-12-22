## 2025-05-18 - [Fix: Enforcing Ownership on Codex Pages]
**Vulnerability:** Publicly writable collections (Codex Pages) lacked ownership checks in `firestore.rules`, allowing any authenticated user to overwrite any page.
**Learning:** Even if a feature feels like a "public wiki", explicit ownership or moderation controls are required to prevent defacement. "Good enough" UI logic (hiding edit buttons) is not security.
**Prevention:** Always pair `create` rules that enforce `creatorId` with `update` rules that check `creatorId`. Never rely on the client to "behave".
