const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { validatePostContent } = require("./validation");

admin.initializeApp();

const openRouterKey = defineSecret("OPENROUTER_API_KEY");

// App ID constant for consistent paths
const APP_ID = 'realm-of-allania-v2';

// OpenRouter model configuration
// Use standard model (not :free suffix) to ensure proper routing with paid API keys
// The :free suffix routes through free-tier infrastructure with stricter rate limits
const OPENROUTER_MODEL = "google/gemini-2.5-flash";

// Export for testing (allows verification of config values sent to third-party APIs)
module.exports.OPENROUTER_MODEL = OPENROUTER_MODEL;

// Helper function to call Gemini AI for text moderation
async function callGeminiTextModeration(content, apiKey, contentType = "post") {
    const systemPrompts = {
        post: `You are a content moderator for a fantasy roleplay forum called "Realm of Aethelraed". Your job is to distinguish between acceptable in-character roleplay and unacceptable content.

ALWAYS APPROVE (respond with exactly "SAFE"):
- In-character roleplay violence (sword fights, battles, fantasy combat)
- Medieval fantasy themes (magic, quests, kingdoms, dragons)
- Character interactions, dialogue, and storytelling
- Emotional roleplay (grief, anger, conflict between characters)
- Fantasy descriptions of locations, items, creatures
- Any coherent roleplay content that fits a fantasy setting

ALWAYS REJECT (respond with "REJECT: [brief reason]"):
- Real-world harassment or personal attacks on other players
- Modern spam, advertisements, or off-topic content
- Real-world hate speech, slurs, or discrimination
- Explicit sexual content (NSFW)
- Completely incoherent gibberish or keyboard spam
- Links to external malicious sites

When in doubt, APPROVE the content. This is a creative writing space where fantasy violence and conflict are normal and expected.

Respond with ONLY "SAFE" or "REJECT: [reason]". Nothing else.`,
        codex: `You are a content moderator for a fantasy wiki/lore database called "Realm of Aethelraed Codex". Your job is to ensure entries are appropriate fantasy lore content.

ALWAYS APPROVE (respond with exactly "SAFE"):
- Character backstories and descriptions
- Location descriptions (towns, dungeons, forests, etc.)
- Historical lore and world-building
- Item descriptions, magic systems, creatures
- Organization/faction information
- Quest logs and story summaries
- Any coherent fantasy lore content

ALWAYS REJECT (respond with "REJECT: [brief reason]"):
- Modern spam or advertisements
- Real-world hate speech or discrimination
- Content completely unrelated to fantasy roleplay
- Explicit sexual content (NSFW)
- Completely incoherent gibberish

When in doubt, APPROVE the content. Creative fantasy content should be welcomed.

Respond with ONLY "SAFE" or "REJECT: [reason]". Nothing else.`
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://realm-of-aethelraed.vercel.app",
            "X-Title": "Realm of Aethelraed Moderation"
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
                {
                    role: "system",
                    content: systemPrompts[contentType] || systemPrompts.post
                },
                {
                    role: "user",
                    content: `Please moderate this ${contentType} content:\n\n${content}`
                }
            ],
            temperature: 0.1,
            max_tokens: 100
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0]?.message?.content || "";
}

// Helper function to parse AI moderation response
function parseAiResponse(aiText) {
    const upperText = aiText.toUpperCase().trim();
    
    // Check for explicit SAFE response
    if (upperText === 'SAFE' || upperText.startsWith('SAFE')) {
        return { status: 'approved', reason: null };
    }
    
    // Check for explicit REJECT response
    if (upperText.startsWith('REJECT')) {
        return { status: 'rejected', reason: aiText };
    }
    
    // Legacy support for old prompts
    if (upperText.includes('VANDALISM') || upperText.includes('HARASSMENT') || upperText.includes('SPAM')) {
        return { status: 'rejected', reason: aiText };
    }
    
    // If response contains positive indicators, approve
    if (upperText.includes('SAFE') || upperText.includes('APPROVED') || upperText.includes('ACCEPTABLE')) {
        return { status: 'approved', reason: null };
    }
    
    // Default to approved for ambiguous responses (lean towards allowing content)
    console.log(`[AI] Ambiguous response, defaulting to approved: ${aiText}`);
    return { status: 'approved', reason: null };
}

// Helper function to extract user ID from storage path
function extractUserIdFromPath(path) {
    // Path format: artifacts/realm-of-allania-v2/public/folder/USER_ID/filename.jpg
    const parts = path.split('/');
    const publicIndex = parts.indexOf('public');
    if (publicIndex !== -1 && publicIndex + 2 < parts.length) {
        return parts[publicIndex + 2];
    }
    return 'unknown';
}

// Helper function to check if user is trusted
async function checkUserRole(userId) {
    const db = admin.firestore();
    try {
        const userDoc = await db.doc(`artifacts/realm-of-allania-v2/users/${userId}/settings/account`).get();
        if (userDoc.exists) {
            const role = userDoc.data().role || 'user';
            return role;
        }
        return 'user';
    } catch (error) {
        console.error("Error checking user role:", error);
        return 'user';
    }
}

// Helper function to create moderation log entry
async function createModerationLog(db, logData) {
    return db.collection(`artifacts/${APP_ID}/public/data/moderation_logs`).add({
        ...logData,
        timestamp: FieldValue.serverTimestamp()
    });
}

// Helper function to send notification to user
async function sendNotification(userId, type, message, metadata = {}) {
    const db = admin.firestore();
    try {
        await db.collection('artifacts/realm-of-allania-v2/users').doc(userId).collection('notifications').add({
            type: type,
            message: message,
            metadata: metadata,
            read: false,
            createdAt: FieldValue.serverTimestamp()
        });
        console.log(`Notification sent to user ${userId}: ${type}`);
    } catch (error) {
        console.error("Error sending notification:", error);
    }
}

// Helper function to delete rejected image for a post
async function deleteRejectedImageForPost(postRef, imageUrl) {
    if (!imageUrl) return;
    
    const db = admin.firestore();
    const storage = admin.storage();
    
    try {
        // Extract file path from imageUrl
        // URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?token=...
        // or gs://bucket/path format
        let filePath = null;
        
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
            const match = imageUrl.match(/\/o\/(.+?)\?/);
            if (match) {
                filePath = decodeURIComponent(match[1]);
            }
        } else if (imageUrl.startsWith('gs://')) {
            filePath = imageUrl.replace(/gs:\/\/[^/]+\//, '');
        }
        
        if (!filePath) {
            console.warn('[Image Delete] Could not parse file path from URL:', imageUrl);
            return;
        }
        
        // Check if image was rejected in moderation logs
        const moderationLogs = await db.collection(`artifacts/${APP_ID}/public/data/moderation_logs`)
            .where('type', '==', 'image')
            .where('filePath', '==', filePath)
            .where('status', '==', 'rejected')
            .limit(1)
            .get();
        
        if (!moderationLogs.empty) {
            console.log(`[Image Delete] Found rejected image, deleting: ${filePath}`);
            
            // Delete from storage
            const bucket = storage.bucket();
            await bucket.file(filePath).delete();
            
            // Update post to remove image reference
            await postRef.update({
                imageUrl: FieldValue.delete(),
                imageStatus: 'deleted',
                imageDeletedAt: FieldValue.serverTimestamp()
            });
            
            console.log(`[Image Delete] Successfully deleted rejected image: ${filePath}`);
        }
    } catch (error) {
        console.error('[Image Delete] Error deleting rejected image:', error.message);
        // Don't throw - this is a cleanup operation, shouldn't block post approval
    }
}

// Helper function to check and promote user to trusted
async function checkAndPromoteUser(userId, contentType) {
    const db = admin.firestore();
    
    // Count approved content across all types
    const [postsSnapshot, codexSnapshot] = await Promise.all([
        db.collection('artifacts/realm-of-allania-v2/public/data/posts')
            .where('userId', '==', userId)
            .where('status', '==', 'approved')
            .get(),
        db.collection('artifacts/realm-of-allania-v2/public/data/codex_pages')
            .where('creatorId', '==', userId)
            .where('status', '==', 'approved')
            .get()
    ]);
    
    const totalApproved = postsSnapshot.size + codexSnapshot.size;
    console.log(`User ${userId} has ${totalApproved} approved items`);
    
    // Promote to trusted after 10 approved items
    if (totalApproved >= 10) {
        const userRef = db.doc(`artifacts/realm-of-allania-v2/users/${userId}/settings/account`);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const currentRole = userDoc.data().role || 'user';
            
            // Only promote if still a regular user
            // This prevents overwriting admin, moderator, banned, or existing trusted roles
            if (currentRole === 'user') {
                await userRef.update({
                    role: 'trusted',
                    promotedAt: FieldValue.serverTimestamp(),
                    promotionReason: `Auto-promoted after ${totalApproved} approved contributions`
                });
                
                // Send congratulations notification
                await sendNotification(userId, 'promotion', 
                    '🎉 Congratulations! You have been promoted to Trusted Contributor! Your future posts will be auto-approved.',
                    { newRole: 'trusted', approvedCount: totalApproved }
                );
                
                console.log(`✨ User ${userId} promoted to TRUSTED (${totalApproved} approved items)`);
            }
        }
    }
}

exports.moderatePost = onDocumentWritten(
    {
        document: "artifacts/realm-of-allania-v2/public/data/posts/{postId}",
        secrets: [openRouterKey],
        timeoutSeconds: 60,
        region: "us-central1"
    },
    async (event) => {
        const change = event.data;
        // If document is deleted, do nothing
        if (!change) return;

        const data = change.after.data();
        const previousData = change.before.data();

        if (!data) return; // Should be handled by !change check for delete, but safety first

        // Initialize Firestore reference once at the top to avoid TDZ issues
        const db = admin.firestore();
        
        const { content, userId } = data;

        // SECURITY FIX: If this is an edit (content changed) and user is NOT trusted,
        // reset status to pending and re-moderate
        if (previousData && data.content !== previousData.content) {
            const userRole = await checkUserRole(userId);
            const isTrusted = userRole === 'trusted' || userRole === 'moderator' || userRole === 'admin';
            
            // If trusted user edited, keep approved status and skip moderation
            if (isTrusted && data.status === 'approved') {
                console.log(`[Post] Trusted user ${userId} edited post, keeping approved status`);
                return;
            }
            
            // Non-trusted user edited approved content - need to reset and re-moderate
            if (!isTrusted && previousData.status === 'approved' && data.status === 'approved') {
                console.log(`[Post] Non-trusted user ${userId} edited approved post, resetting to pending`);
                await change.after.ref.update({
                    status: 'pending',
                    editedAt: FieldValue.serverTimestamp()
                });
                // Continue to moderation below with the new pending status
            }
        }

        // Re-fetch data after potential status update
        const currentData = (await change.after.ref.get()).data();
        const currentStatus = currentData?.status || data.status;

        // Prevent infinite loops:
        // If status is already final (approved, rejected, or needs_review), abort.
        if (currentStatus === 'approved' || currentStatus === 'rejected' || currentStatus === 'needs_review') {
            return;
        }

        // If this is an update, and content hasn't changed, we might not need to re-moderate
        if (previousData) {
            if (data.content === previousData.content && currentStatus === previousData.status) {
                return;
            }
        }

        // Check if user is trusted - if so, auto-approve
        const userRole = await checkUserRole(userId);
        if (userRole === 'trusted' || userRole === 'moderator' || userRole === 'admin') {
            console.log(`[Post] User ${userId} is ${userRole}, auto-approving`);
            await change.after.ref.update({
                status: 'approved',
                moderationMethod: 'trusted-user',
                moderatedAt: FieldValue.serverTimestamp()
            });
            
            // Check for rejected image and delete if necessary
            if (data.imageUrl) {
                await deleteRejectedImageForPost(change.after.ref, data.imageUrl);
            }
            
            // Also approve the parent thread so it becomes visible to all users
            if (data.threadId) {
                try {
                    const threadRef = db.doc(`artifacts/${APP_ID}/public/data/threads/${data.threadId}`);
                    const threadDoc = await threadRef.get();
                    if (threadDoc.exists && threadDoc.data().status !== 'approved') {
                        await threadRef.update({
                            status: 'approved',
                            moderatedAt: FieldValue.serverTimestamp()
                        });
                        console.log(`[Post] Also approved parent thread ${data.threadId}`);
                    }
                } catch (e) {
                    console.warn("[Post] Could not update parent thread status:", e);
                }
            }
            
            // Create moderation log entry
            await createModerationLog(db, {
                type: 'post',
                contentId: event.params.postId,
                threadId: data.threadId,
                userId: userId,
                content: content.substring(0, 500), // Store preview
                status: 'approved',
                moderationMethod: 'trusted-user'
            });
            return;
        }

        // --- Layer 2: Auto-Regex Validation ---
        console.log(`[Layer 2] Validating post ${event.params.postId}...`);
        const validation = validatePostContent(content);
        if (!validation.isValid) {
            console.log(`[Layer 2] Failed: ${validation.error}`);
            
            // Send notification to user
            await sendNotification(userId, 'content_rejected', 
                `Your post was rejected: ${validation.error}`,
                { contentType: 'post', postId: event.params.postId, reason: validation.error }
            );
            
            await change.after.ref.update({
                status: 'rejected',
                flaggedReason: validation.error,
                moderationMethod: 'auto-regex',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'post',
                contentId: event.params.postId,
                threadId: data.threadId,
                userId: userId,
                content: content.substring(0, 500),
                status: 'rejected',
                flaggedReason: validation.error,
                moderationMethod: 'auto-regex'
            });
            return;
        }

        // --- Layer 3: AI Moderation ---
        console.log(`[Layer 3] Content valid. Calling AI...`);
        const apiKey = openRouterKey.value();

        // [MOCK] Check for Mock Response in Emulator
        if (process.env.FUNCTIONS_EMULATOR === 'true' && data._mockAiResponse) {
            console.log(`[Layer 3] Using Mock Response: ${data._mockAiResponse}`);
            const mockParsed = parseAiResponse(data._mockAiResponse);
            return change.after.ref.update({
                status: mockParsed.status,
                flaggedReason: mockParsed.reason,
                moderationMethod: 'ai-check',
                moderatedAt: FieldValue.serverTimestamp(),
                _mockAiResponse: FieldValue.delete()
            });
        }

        // If API key is missing, mark for manual review instead of leaving pending
        if (!apiKey) {
            console.error("[Layer 3] No OpenRouter API Key found - marking for manual review");
            await change.after.ref.update({
                status: 'needs_review',
                flaggedReason: 'AI moderation unavailable - requires manual review',
                moderationMethod: 'auto-fallback',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'post',
                contentId: event.params.postId,
                threadId: data.threadId,
                userId: userId,
                content: content.substring(0, 500),
                status: 'needs_review',
                flaggedReason: 'AI moderation unavailable - requires manual review',
                moderationMethod: 'auto-fallback'
            });
            return;
        }

        try {
            const aiText = await callGeminiTextModeration(content, apiKey, 'post');
            console.log(`[Layer 3] AI Response: ${aiText}`);

            const { status, reason } = parseAiResponse(aiText);
            console.log(`[Layer 3] Parsed: status=${status}, reason=${reason}`);

            // Send notifications and check for auto-promotion
            if (status === 'rejected') {
                await sendNotification(userId, 'content_rejected', 
                    `Your post was flagged by AI moderation: ${reason}`,
                    { contentType: 'post', postId: event.params.postId, reason: reason }
                );
            } else if (status === 'approved') {
                // Check for auto-promotion
                await checkAndPromoteUser(userId, 'post');
                
                // Check for rejected image and delete if necessary
                if (data.imageUrl) {
                    await deleteRejectedImageForPost(change.after.ref, data.imageUrl);
                }
                
                // Also approve the parent thread so it becomes visible to all users
                if (data.threadId) {
                    try {
                        const threadRef = db.doc(`artifacts/${APP_ID}/public/data/threads/${data.threadId}`);
                        const threadDoc = await threadRef.get();
                        if (threadDoc.exists && threadDoc.data().status !== 'approved') {
                            await threadRef.update({
                                status: 'approved',
                                moderatedAt: FieldValue.serverTimestamp()
                            });
                            console.log(`[Post] Also approved parent thread ${data.threadId}`);
                        }
                    } catch (e) {
                        console.warn("[Post] Could not update parent thread status:", e);
                    }
                }
            }

            await change.after.ref.update({
                status: status,
                flaggedReason: reason,
                moderationMethod: 'ai-check',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'post',
                contentId: event.params.postId,
                threadId: data.threadId,
                userId: userId,
                content: content.substring(0, 500),
                status: status,
                flaggedReason: reason,
                moderationMethod: 'ai-check'
            });
            return;

        } catch (error) {
            console.error("[Layer 3] Error calling AI:", error.message);
            
            // On API error, mark for manual review instead of leaving in pending
            await change.after.ref.update({
                status: 'needs_review',
                flaggedReason: `AI moderation failed: ${error.message}`,
                moderationMethod: 'auto-fallback',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'post',
                contentId: event.params.postId,
                threadId: data.threadId,
                userId: userId,
                content: content.substring(0, 500),
                status: 'needs_review',
                flaggedReason: `AI moderation failed: ${error.message}`,
                moderationMethod: 'auto-fallback'
            });
            return;
        }
    }
);

// ==========================================
// CODEX PAGE MODERATION
// ==========================================
exports.moderateCodexPage = onDocumentWritten(
    {
        document: "artifacts/realm-of-allania-v2/public/data/codex_pages/{pageId}",
        secrets: [openRouterKey],
        timeoutSeconds: 60,
        region: "us-central1"
    },
    async (event) => {
        const change = event.data;
        if (!change) return;

        const data = change.after.data();
        const previousData = change.before.data();

        if (!data) return;

        // Initialize Firestore reference once at the top to avoid TDZ issues
        const db = admin.firestore();

        const { content, title, creatorId, lastEditorId } = data;
        const editorId = lastEditorId || creatorId;

        // SECURITY FIX: If this is an edit (content/title changed) and user is NOT trusted,
        // reset status to pending and re-moderate
        if (previousData && (data.content !== previousData.content || data.title !== previousData.title)) {
            const userRole = await checkUserRole(editorId);
            const isTrusted = userRole === 'trusted' || userRole === 'moderator' || userRole === 'admin';
            
            // If trusted user edited, keep approved status and skip moderation
            if (isTrusted && data.status === 'approved') {
                console.log(`[Codex] Trusted user ${editorId} edited page, keeping approved status`);
                return;
            }
            
            // Non-trusted user edited approved content - need to reset and re-moderate
            if (!isTrusted && previousData.status === 'approved' && data.status === 'approved') {
                console.log(`[Codex] Non-trusted user ${editorId} edited approved page, resetting to pending`);
                await change.after.ref.update({
                    status: 'pending',
                    editedAt: FieldValue.serverTimestamp()
                });
                // Continue to moderation below with the new pending status
            }
        }

        // Re-fetch data after potential status update
        const currentData = (await change.after.ref.get()).data();
        const currentStatus = currentData?.status || data.status;

        // Prevent infinite loops:
        // If status is already final (approved, rejected, or needs_review), abort.
        if (currentStatus === 'approved' || currentStatus === 'rejected' || currentStatus === 'needs_review') {
            return;
        }

        // Skip if content unchanged
        if (previousData) {
            if (data.content === previousData.content && 
                data.title === previousData.title && 
                currentStatus === previousData.status) {
                return;
            }
        }
        const fullContent = `Title: ${title}\n\nContent: ${content}`;

        // Check if user is trusted - if so, auto-approve
        const userRole = await checkUserRole(editorId);
        if (userRole === 'trusted' || userRole === 'moderator' || userRole === 'admin') {
            console.log(`[Codex] User ${editorId} is ${userRole}, auto-approving`);
            await change.after.ref.update({
                status: 'approved',
                moderationMethod: 'trusted-user',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'codex',
                contentId: event.params.pageId,
                userId: editorId,
                title: title,
                content: content.substring(0, 500),
                status: 'approved',
                moderationMethod: 'trusted-user'
            });
            return;
        }

        // --- Layer 2: Auto-Regex Validation ---
        console.log(`[Codex Layer 2] Validating page ${event.params.pageId}...`);
        const validation = validatePostContent(fullContent);
        if (!validation.isValid) {
            console.log(`[Codex Layer 2] Failed: ${validation.error}`);
            
            // Send notification to user
            await sendNotification(editorId, 'content_rejected', 
                `Your codex page "${title}" was rejected: ${validation.error}`,
                { contentType: 'codex', pageId: event.params.pageId, title: title, reason: validation.error }
            );
            
            await change.after.ref.update({
                status: 'rejected',
                flaggedReason: validation.error,
                moderationMethod: 'auto-regex',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'codex',
                contentId: event.params.pageId,
                userId: editorId,
                title: title,
                content: content.substring(0, 500),
                status: 'rejected',
                flaggedReason: validation.error,
                moderationMethod: 'auto-regex'
            });
            return;
        }

        // --- Layer 3: AI Moderation ---
        console.log(`[Codex Layer 3] Content valid. Calling AI...`);
        const apiKey = openRouterKey.value();

        // Mock support for emulator
        if (process.env.FUNCTIONS_EMULATOR === 'true' && data._mockAiResponse) {
            console.log(`[Codex Layer 3] Using Mock Response: ${data._mockAiResponse}`);
            const mockParsed = parseAiResponse(data._mockAiResponse);
            return change.after.ref.update({
                status: mockParsed.status,
                flaggedReason: mockParsed.reason,
                moderationMethod: 'ai-check',
                moderatedAt: FieldValue.serverTimestamp(),
                _mockAiResponse: FieldValue.delete()
            });
        }

        // If API key is missing, mark for manual review instead of leaving pending
        if (!apiKey) {
            console.error("[Codex Layer 3] No OpenRouter API Key found - marking for manual review");
            await change.after.ref.update({
                status: 'needs_review',
                flaggedReason: 'AI moderation unavailable - requires manual review',
                moderationMethod: 'auto-fallback',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'codex',
                contentId: event.params.pageId,
                userId: editorId,
                title: title,
                content: content.substring(0, 500),
                status: 'needs_review',
                flaggedReason: 'AI moderation unavailable - requires manual review',
                moderationMethod: 'auto-fallback'
            });
            return;
        }

        try {
            const aiText = await callGeminiTextModeration(fullContent, apiKey, 'codex');
            console.log(`[Codex Layer 3] AI Response: ${aiText}`);

            const { status, reason } = parseAiResponse(aiText);
            console.log(`[Codex Layer 3] Parsed: status=${status}, reason=${reason}`);

            // Send notifications and check for auto-promotion
            if (status === 'rejected') {
                await sendNotification(editorId, 'content_rejected', 
                    `Your codex page "${title}" was flagged by AI moderation: ${reason}`,
                    { contentType: 'codex', pageId: event.params.pageId, title: title, reason: reason }
                );
            } else if (status === 'approved') {
                // Check for auto-promotion
                await checkAndPromoteUser(editorId, 'codex');
            }

            await change.after.ref.update({
                status: status,
                flaggedReason: reason,
                moderationMethod: 'ai-check',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'codex',
                contentId: event.params.pageId,
                userId: editorId,
                title: title,
                content: content.substring(0, 500),
                status: status,
                flaggedReason: reason,
                moderationMethod: 'ai-check'
            });
            return;

        } catch (error) {
            console.error("[Codex Layer 3] Error calling AI:", error.message);
            
            // On API error, mark for manual review instead of leaving in pending
            await change.after.ref.update({
                status: 'needs_review',
                flaggedReason: `AI moderation failed: ${error.message}`,
                moderationMethod: 'auto-fallback',
                moderatedAt: FieldValue.serverTimestamp()
            });

            // Create moderation log entry
            await createModerationLog(db, {
                type: 'codex',
                contentId: event.params.pageId,
                userId: editorId,
                title: title,
                content: content.substring(0, 500),
                status: 'needs_review',
                flaggedReason: `AI moderation failed: ${error.message}`,
                moderationMethod: 'auto-fallback'
            });
            return;
        }
    }
);

// ==========================================
// IMAGE MODERATION
// ==========================================
exports.moderateImage = onObjectFinalized(
    {
        secrets: [openRouterKey],
        timeoutSeconds: 90,
        region: "us-central1",
        memory: "512MiB"
    },
    async (event) => {
        const filePath = event.data.name;
        const bucket = event.data.bucket;

        // Only moderate images in public folders (not legacy/protected files)
        if (!filePath.includes('/public/') || !filePath.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            console.log(`[Image Mod] Skipping non-public or non-image file: ${filePath}`);
            return;
        }

        console.log(`[Image Mod] Checking: ${filePath}`);

        const db = admin.firestore();
        const storage = admin.storage();
        const userId = extractUserIdFromPath(filePath);

        // Check if user is trusted - if so, auto-approve (still log, but don't run AI check)
        const userRole = await checkUserRole(userId);
        if (userRole === 'trusted' || userRole === 'moderator' || userRole === 'admin') {
            console.log(`[Image Mod] User ${userId} is ${userRole}, auto-approving image`);
            
            // Log as approved by trusted user
            await createModerationLog(db, {
                type: 'image',
                filePath: filePath,
                userId: userId,
                status: 'approved',
                moderationMethod: 'trusted-user'
            });
            
            return; // Skip AI moderation
        }

        const apiKey = openRouterKey.value();
        
        // If API key is missing, log for manual review but don't delete the image
        if (!apiKey) {
            console.error("[Image Mod] No OpenRouter API Key found - marking for manual review");
            await createModerationLog(db, {
                type: 'image',
                filePath: filePath,
                userId: userId,
                status: 'needs_review',
                flaggedReason: 'AI moderation unavailable - requires manual review',
                moderationMethod: 'auto-fallback'
            });
            return;
        }

        try {
            // Get a signed URL for the image
            const file = storage.bucket(bucket).file(filePath);
            const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 15 * 60 * 1000 // 15 minutes
            });

            console.log(`[Image Mod] Got signed URL, calling Gemini Vision...`);

            // Call Gemini 2.5 Flash with Vision
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://realm-of-aethelraed.vercel.app",
                    "X-Title": "Realm of Aethelraed Image Moderation"
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `You are a content moderator for a fantasy roleplay game called "Realm of Aethelraed".

Analyze this image and determine if it's appropriate for:
- Character portraits (medieval fantasy characters)
- Banners (scenic landscapes, castles, fantasy artwork)
- Codex entries (lore illustrations, maps, items)

ALWAYS APPROVE (respond with exactly "SAFE"):
- Fantasy art (elves, warriors, dragons, medieval themes)
- Landscapes and scenery
- Medieval/fantasy themed artwork
- Character illustrations (non-sexual)
- Maps, diagrams, items
- Artistic violence in fantasy context
- AI-generated fantasy artwork
- Stock photos of nature, castles, medieval settings

ALWAYS REJECT (respond with "UNSAFE: [brief reason]"):
- NSFW/sexual content
- Real-world hate symbols
- Extreme graphic violence/gore (realistic, not stylized)
- Modern memes with text overlays
- Clearly off-topic modern images (cars, phones, celebrities)
- Shock/disturbing content

When in doubt, APPROVE the image. Fantasy artwork should be welcomed.

Respond with ONLY "SAFE" or "UNSAFE: [reason]". Nothing else.`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: url
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 100
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
            }

            const result = await response.json();
            const aiResponse = result.choices[0]?.message?.content || "";
            console.log(`[Image Mod] AI Response: ${aiResponse}`);

            // Take action based on result
            const upperResponse = aiResponse.toUpperCase().trim();
            
            if (upperResponse.includes("UNSAFE")) {
                console.log(`[Image Mod] REJECTED: ${filePath}`);

                // Delete the unsafe image
                await file.delete();

                // Send notification to user
                await sendNotification(userId, 'image_rejected', 
                    `Your uploaded image was rejected: ${aiResponse}`,
                    { contentType: 'image', filePath: filePath, reason: aiResponse }
                );

                // Log to Firestore
                await createModerationLog(db, {
                    type: 'image',
                    filePath: filePath,
                    userId: userId,
                    status: 'rejected',
                    flaggedReason: aiResponse,
                    moderationMethod: 'ai-check'
                });

                console.log(`[Image Mod] Deleted unsafe image: ${filePath}`);
            } else {
                console.log(`[Image Mod] APPROVED: ${filePath}`);

                // Log approved images
                await createModerationLog(db, {
                    type: 'image',
                    filePath: filePath,
                    userId: userId,
                    status: 'approved',
                    moderationMethod: 'ai-check'
                });
            }

        } catch (error) {
            console.error("[Image Mod] Error:", error.message);

            // Log error for manual review - don't delete the image on error
            await createModerationLog(db, {
                type: 'image',
                filePath: filePath,
                userId: userId,
                status: 'needs_review',
                flaggedReason: `AI moderation failed: ${error.message}`,
                moderationMethod: 'auto-fallback'
            });
        }
    }
);
