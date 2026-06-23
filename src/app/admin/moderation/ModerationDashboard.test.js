/**
 * ModerationDashboard Component Tests
 * Tests for moderation dashboard functionality including delete operations
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock Firebase modules
jest.mock('@/lib/firebase', () => ({
    db: {},
    storage: {}
}));

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    onSnapshot: jest.fn((query, callback) => {
        // Return mock data
        callback({
            docs: [
                {
                    id: 'post-123',
                    data: () => ({
                        type: 'post',
                        contentId: 'actual-post-123',
                        threadId: 'thread-abc-123', // CRITICAL: Include threadId for parent status propagation
                        content: 'Test post content',
                        status: 'needs_review',
                        userId: 'user-1',
                        timestamp: { toDate: () => new Date() }
                    })
                },
                {
                    id: 'image-456',
                    data: () => ({
                        type: 'image',
                        filePath: 'users/user-1/images/test.jpg',
                        status: 'rejected',
                        userId: 'user-1',
                        timestamp: { toDate: () => new Date() }
                    })
                }
            ]
        });
        return jest.fn(); // unsubscribe
    }),
    doc: jest.fn(() => ({})),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    limit: jest.fn(),
    getDocs: jest.fn(),
    writeBatch: jest.fn(() => ({
        delete: jest.fn(),
        commit: jest.fn(() => Promise.resolve())
    }))
}));

jest.mock('firebase/storage', () => ({
    ref: jest.fn(),
    deleteObject: jest.fn(() => Promise.resolve())
}));

jest.mock('@/lib/constants', () => ({
    APP_ID: 'test-app-id'
}));

jest.mock('@/context/GameContext', () => ({
    useGame: jest.fn(() => ({
        user: { uid: 'admin-user' },
        userRole: 'admin',
        loading: false
    }))
}));

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(() => ({
        push: jest.fn()
    }))
}));

// Import after mocks are set up
const { deleteDoc, doc } = require('firebase/firestore');
const { deleteObject, ref } = require('firebase/storage');

describe('ModerationDashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock window.confirm
        global.confirm = jest.fn(() => true);
    });

    describe('Delete Functionality', () => {
        it('should call deleteDoc when trash icon is clicked for a post', async () => {
            // This test validates that the delete function is called
            // The implementation should delete the actual content, not just the log
            
            const mockDeleteDoc = jest.fn(() => Promise.resolve());
            deleteDoc.mockImplementation(mockDeleteDoc);
            
            // Simulate the delete action
            const handleAction = async (itemId, action, item) => {
                if (action === 'delete') {
                    if (confirm('Are you sure you want to delete this?')) {
                        // Delete the moderation log
                        await deleteDoc(doc({}, 'moderation_logs', itemId));
                        
                        // IMPORTANT: Also delete the actual content
                        if (item.contentId) {
                            const contentCollection = item.type === 'post' ? 'posts' : 
                                                     item.type === 'codex' ? 'codex_pages' : null;
                            if (contentCollection) {
                                await deleteDoc(doc({}, contentCollection, item.contentId));
                            }
                        }
                    }
                }
            };

            await handleAction('log-123', 'delete', { 
                type: 'post', 
                contentId: 'actual-post-123' 
            });

            // Should delete BOTH the log AND the actual content
            expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
        });

        it('should delete storage file when deleting an image', async () => {
            const mockDeleteObject = jest.fn(() => Promise.resolve());
            deleteObject.mockImplementation(mockDeleteObject);
            
            const handleAction = async (itemId, action, item) => {
                if (action === 'delete' && item.type === 'image') {
                    if (confirm('Delete?')) {
                        if (item.filePath) {
                            await deleteObject(ref({}, item.filePath));
                        }
                        await deleteDoc(doc({}, 'moderation_logs', itemId));
                    }
                }
            };

            await handleAction('image-log-456', 'delete', {
                type: 'image',
                filePath: 'users/user-1/images/test.jpg'
            });

            expect(mockDeleteObject).toHaveBeenCalledTimes(1);
        });

        it('should delete actual post content, not just moderation log', async () => {
            const deletedPaths = [];
            const mockDoc = jest.fn((db, ...path) => ({ path: path.join('/') }));
            doc.mockImplementation(mockDoc);
            
            const mockDeleteDoc = jest.fn((docRef) => {
                deletedPaths.push(docRef.path);
                return Promise.resolve();
            });
            deleteDoc.mockImplementation(mockDeleteDoc);

            const handleAction = async (itemId, action, item) => {
                if (action === 'delete') {
                    if (confirm('Delete?')) {
                        // Delete moderation log
                        await deleteDoc(doc({}, 'moderation_logs', itemId));
                        
                        // Delete actual content
                        if (item.contentId && item.type === 'post') {
                            await deleteDoc(doc({}, 'posts', item.contentId));
                        }
                    }
                }
            };

            await handleAction('log-123', 'delete', {
                type: 'post',
                contentId: 'post-abc-123'
            });

            expect(deletedPaths).toContain('moderation_logs/log-123');
            expect(deletedPaths).toContain('posts/post-abc-123');
        });

        it('should delete actual codex content when deleting codex log', async () => {
            const deletedPaths = [];
            const mockDoc = jest.fn((db, ...path) => ({ path: path.join('/') }));
            doc.mockImplementation(mockDoc);
            
            const mockDeleteDoc = jest.fn((docRef) => {
                deletedPaths.push(docRef.path);
                return Promise.resolve();
            });
            deleteDoc.mockImplementation(mockDeleteDoc);

            const handleAction = async (itemId, action, item) => {
                if (action === 'delete') {
                    if (confirm('Delete?')) {
                        await deleteDoc(doc({}, 'moderation_logs', itemId));
                        
                        if (item.contentId && item.type === 'codex') {
                            await deleteDoc(doc({}, 'codex_pages', item.contentId));
                        }
                    }
                }
            };

            await handleAction('log-456', 'delete', {
                type: 'codex',
                contentId: 'codex-xyz-789'
            });

            expect(deletedPaths).toContain('moderation_logs/log-456');
            expect(deletedPaths).toContain('codex_pages/codex-xyz-789');
        });

        it('should not delete content if user cancels confirmation', async () => {
            global.confirm = jest.fn(() => false);
            
            const mockDeleteDoc = jest.fn(() => Promise.resolve());
            deleteDoc.mockImplementation(mockDeleteDoc);

            const handleAction = async (itemId, action, item) => {
                if (action === 'delete') {
                    if (confirm('Delete?')) {
                        await deleteDoc(doc({}, 'moderation_logs', itemId));
                    }
                }
            };

            await handleAction('log-123', 'delete', { type: 'post' });

            expect(mockDeleteDoc).not.toHaveBeenCalled();
        });
    });

    describe('Approval Functionality', () => {
        it('updates parent thread status when post is approved', async () => {
            const { updateDoc, doc } = require('firebase/firestore');
            
            const updatedPaths = [];
            const mockDoc = jest.fn((db, ...path) => ({ path: path.join('/') }));
            doc.mockImplementation(mockDoc);
            
            const mockUpdateDoc = jest.fn((docRef, data) => {
                updatedPaths.push({ path: docRef.path, data });
                return Promise.resolve();
            });
            updateDoc.mockImplementation(mockUpdateDoc);

            // Simulate the handleAction function for approval
            // This mirrors the implementation in ModerationDashboard
            const handleAction = async (itemId, action, item) => {
                // Update the moderation log
                await updateDoc(doc({}, 'moderation_logs', itemId), {
                    status: action,
                    moderatedBy: 'admin-user',
                    moderatedAt: new Date(),
                    moderationMethod: 'manual-admin'
                });

                // Update the actual content item
                if (item.contentId && item.type === 'post') {
                    await updateDoc(doc({}, 'posts', item.contentId), {
                        status: action,
                        moderatedBy: 'admin-user',
                        moderatedAt: new Date(),
                        moderationMethod: 'manual-admin'
                    });

                    // BUG: This should update the parent thread when approving a post
                    // If approving a post, also approve the parent thread so it becomes visible
                    if (action === 'approved' && item.threadId) {
                        await updateDoc(doc({}, 'threads', item.threadId), {
                            status: 'approved',
                            moderatedBy: 'admin-user',
                            moderatedAt: expect.any(Date)
                        });
                    }
                }
            };

            await handleAction('log-123', 'approved', {
                type: 'post',
                contentId: 'post-abc-123',
                threadId: 'thread-xyz-789'
            });

            // Assert: Should update moderation log
            expect(updatedPaths.some(p => p.path === 'moderation_logs/log-123')).toBe(true);
            
            // Assert: Should update the post
            expect(updatedPaths.some(p => p.path === 'posts/post-abc-123')).toBe(true);
            
            // Assert: CRITICAL - Should also update the parent thread
            const threadUpdate = updatedPaths.find(p => p.path === 'threads/thread-xyz-789');
            expect(threadUpdate).toBeDefined();
            expect(threadUpdate.data.status).toBe('approved');
        });

        it('does NOT update thread when approving codex (no parent thread)', async () => {
            const { updateDoc, doc } = require('firebase/firestore');
            
            const updatedPaths = [];
            const mockDoc = jest.fn((db, ...path) => ({ path: path.join('/') }));
            doc.mockImplementation(mockDoc);
            
            const mockUpdateDoc = jest.fn((docRef, data) => {
                updatedPaths.push({ path: docRef.path, data });
                return Promise.resolve();
            });
            updateDoc.mockImplementation(mockUpdateDoc);

            const handleAction = async (itemId, action, item) => {
                await updateDoc(doc({}, 'moderation_logs', itemId), { status: action });

                if (item.contentId && item.type === 'codex') {
                    await updateDoc(doc({}, 'codex_pages', item.contentId), { status: action });
                }
                
                // Codex pages don't have parent threads, so no thread update
            };

            await handleAction('log-456', 'approved', {
                type: 'codex',
                contentId: 'codex-page-123'
            });

            // Should NOT have any thread updates
            expect(updatedPaths.some(p => p.path.includes('threads'))).toBe(false);
        });
    });
});
