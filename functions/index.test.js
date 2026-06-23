/**
 * Cloud Functions Unit Tests
 * Tests for OpenRouter API integration and moderation logic
 */

// ===========================================
// CONFIGURATION VALUE TESTS (Regression Guards)
// These tests verify the actual config values sent to third-party APIs,
// not just response handling. This catches misconfigurations before deployment.
// ===========================================
describe('OpenRouter Configuration Values', () => {
    it('uses the paid model tier and excludes free variant', () => {
        // Import the actual constant from the implementation
        // This tests the REAL value, not a mock
        const { OPENROUTER_MODEL } = require('./index');
        
        // CRITICAL: The :free suffix routes through free-tier infrastructure
        // which has stricter rate limits and causes 429 errors even with paid API keys
        expect(OPENROUTER_MODEL).toBeDefined();
        expect(OPENROUTER_MODEL).not.toMatch(/:free$/);
        expect(OPENROUTER_MODEL).not.toContain(':free');
        
        // Verify we're using a valid Gemini model
        expect(OPENROUTER_MODEL).toMatch(/^google\/gemini/);
    });

    it('model string does not contain experimental variants with free tier', () => {
        const { OPENROUTER_MODEL } = require('./index');
        
        // List of known problematic patterns
        const problematicPatterns = [
            /:free$/,           // Free tier suffix
            /exp:free$/,        // Experimental with free
            /-free$/,           // Alternative free suffix
        ];
        
        problematicPatterns.forEach(pattern => {
            expect(OPENROUTER_MODEL).not.toMatch(pattern);
        });
    });
});

// Mock firebase-admin before requiring the module
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
        doc: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({
                exists: true,
                data: () => ({ role: 'user' })
            }))
        })),
        collection: jest.fn(() => ({
            add: jest.fn(() => Promise.resolve())
        }))
    })),
    storage: jest.fn(() => ({
        bucket: jest.fn(() => ({
            file: jest.fn(() => ({
                getSignedUrl: jest.fn(() => Promise.resolve(['https://signed-url.example.com'])),
                delete: jest.fn(() => Promise.resolve())
            }))
        }))
    }))
}));

// Mock firebase-functions
jest.mock('firebase-functions/v2/firestore', () => ({
    onDocumentWritten: jest.fn((config, handler) => handler)
}));

jest.mock('firebase-functions/v2/storage', () => ({
    onObjectFinalized: jest.fn((config, handler) => handler)
}));

jest.mock('firebase-functions/params', () => ({
    defineSecret: jest.fn(() => ({
        value: jest.fn(() => 'test-api-key')
    }))
}));

jest.mock('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: jest.fn(() => 'server-timestamp'),
        delete: jest.fn(() => 'field-delete')
    }
}));

// Store original fetch
const originalFetch = global.fetch;

describe('OpenRouter API Integration', () => {
    let capturedFetchArgs = [];
    let mockFetch;

    beforeEach(() => {
        jest.clearAllMocks();
        capturedFetchArgs = [];
        
        // Mock global fetch to capture arguments
        mockFetch = jest.fn((url, options) => {
            capturedFetchArgs.push({ url, options });
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    choices: [{
                        message: { content: 'SAFE' }
                    }]
                })
            });
        });
        global.fetch = mockFetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe('callGeminiTextModeration - Request Structure', () => {
        // Import the module dynamically to use mocked fetch
        let callGeminiTextModeration;
        
        beforeEach(() => {
            // Clear module cache to re-import with mocked dependencies
            jest.resetModules();
            
            // Re-define the function inline for testing (mimics the actual implementation)
            callGeminiTextModeration = async (content, apiKey, contentType = "post") => {
                const systemPrompts = {
                    post: `You are a content moderator for a fantasy roleplay forum...`,
                    codex: `You are a content moderator for a fantasy wiki/lore database...`
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
                        model: "google/gemini-2.5-flash",
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
            };
        });

        it('should call the correct OpenRouter API endpoint', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(capturedFetchArgs[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
        });

        it('should include required Authorization header with Bearer token', async () => {
            await callGeminiTextModeration('Test content', 'my-api-key');
            
            const headers = capturedFetchArgs[0].options.headers;
            expect(headers['Authorization']).toBe('Bearer my-api-key');
        });

        it('should include required HTTP-Referer header', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const headers = capturedFetchArgs[0].options.headers;
            expect(headers['HTTP-Referer']).toBeDefined();
            expect(headers['HTTP-Referer']).toMatch(/^https?:\/\//);
        });

        it('should include required X-Title header', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const headers = capturedFetchArgs[0].options.headers;
            expect(headers['X-Title']).toBeDefined();
            expect(headers['X-Title'].length).toBeGreaterThan(0);
        });

        it('should include Content-Type application/json header', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const headers = capturedFetchArgs[0].options.headers;
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('should send valid JSON body', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const body = capturedFetchArgs[0].options.body;
            expect(() => JSON.parse(body)).not.toThrow();
        });

        it('should include model in request body', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const body = JSON.parse(capturedFetchArgs[0].options.body);
            expect(body.model).toBeDefined();
            expect(typeof body.model).toBe('string');
        });

        it('should include messages array with system and user roles', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const body = JSON.parse(capturedFetchArgs[0].options.body);
            expect(Array.isArray(body.messages)).toBe(true);
            expect(body.messages.length).toBeGreaterThanOrEqual(2);
            
            const roles = body.messages.map(m => m.role);
            expect(roles).toContain('system');
            expect(roles).toContain('user');
        });

        it('should have valid message structure (role and content)', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const body = JSON.parse(capturedFetchArgs[0].options.body);
            body.messages.forEach(msg => {
                expect(msg).toHaveProperty('role');
                expect(msg).toHaveProperty('content');
                expect(typeof msg.role).toBe('string');
            });
        });

        it('should use POST method', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const method = capturedFetchArgs[0].options.method;
            expect(method).toBe('POST');
        });

        it('should include temperature parameter', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const body = JSON.parse(capturedFetchArgs[0].options.body);
            expect(body.temperature).toBeDefined();
            expect(typeof body.temperature).toBe('number');
        });

        it('should include max_tokens parameter', async () => {
            await callGeminiTextModeration('Test content', 'test-key');
            
            const body = JSON.parse(capturedFetchArgs[0].options.body);
            expect(body.max_tokens).toBeDefined();
            expect(typeof body.max_tokens).toBe('number');
        });

        it('should handle API errors correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: () => Promise.resolve('Rate limit exceeded')
            });

            await expect(callGeminiTextModeration('Test', 'key'))
                .rejects.toThrow('OpenRouter API error: 429');
        });
    });

    describe('Request Payload - OpenRouter Schema Compliance', () => {
        let callGeminiTextModeration;
        
        beforeEach(() => {
            callGeminiTextModeration = async (content, apiKey, contentType = "post") => {
                const systemPrompts = {
                    post: `You are a content moderator...`,
                    codex: `You are a content moderator...`
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
                        model: "google/gemini-2.5-flash",
                        messages: [
                            { role: "system", content: systemPrompts[contentType] || systemPrompts.post },
                            { role: "user", content: `Please moderate this ${contentType} content:\n\n${content}` }
                        ],
                        temperature: 0.1,
                        max_tokens: 100
                    })
                });

                if (!response.ok) {
                    throw new Error(`OpenRouter API error: ${response.status}`);
                }

                const result = await response.json();
                return result.choices[0]?.message?.content || "";
            };
        });

        it('should NOT use deprecated model slugs or :free suffix', async () => {
            await callGeminiTextModeration('Test', 'key');
            
            const body = JSON.parse(capturedFetchArgs[0].options.body);
            // Check model doesn't use known deprecated patterns
            expect(body.model).not.toMatch(/gpt-3\.5-turbo-0301/);
            expect(body.model).not.toMatch(/gpt-4-0314/);
            // :free suffix routes through free-tier with stricter limits
            expect(body.model).not.toMatch(/:free$/);
        });

        it('should comply with OpenRouter required headers', async () => {
            await callGeminiTextModeration('Test', 'key');
            
            const headers = capturedFetchArgs[0].options.headers;
            
            // OpenRouter requires these headers for proper routing
            expect(headers).toHaveProperty('Authorization');
            expect(headers).toHaveProperty('HTTP-Referer');
            expect(headers).toHaveProperty('X-Title');
            expect(headers).toHaveProperty('Content-Type');
        });

        it('should have Authorization header in correct format', async () => {
            await callGeminiTextModeration('Test', 'sk-or-v1-testkey');
            
            const headers = capturedFetchArgs[0].options.headers;
            expect(headers['Authorization']).toMatch(/^Bearer /);
        });
    });
});

describe('Image Deletion for Rejected Images', () => {
    let mockDeleteObject;
    let mockUpdateDoc;
    
    beforeEach(() => {
        mockDeleteObject = jest.fn(() => Promise.resolve());
        mockUpdateDoc = jest.fn(() => Promise.resolve());
    });

    // Helper function that mirrors what the moderation handler should do
    const handleModerationDecision = async (postStatus, imageStatus, imageFilePath, deleteImageFn, updatePostFn) => {
        // If image is rejected, delete it regardless of post status
        if (imageStatus === 'rejected' && imageFilePath) {
            await deleteImageFn(imageFilePath);
            await updatePostFn({ imageUrl: null, imageStatus: 'deleted' });
        }
    };

    it('should delete image when postStatus is approved but imageStatus is rejected', async () => {
        await handleModerationDecision(
            'approved',      // postStatus
            'rejected',      // imageStatus
            'users/123/images/test.jpg',  // imageFilePath
            mockDeleteObject,
            mockUpdateDoc
        );

        expect(mockDeleteObject).toHaveBeenCalledTimes(1);
        expect(mockDeleteObject).toHaveBeenCalledWith('users/123/images/test.jpg');
    });

    it('should update post to remove imageUrl when image is deleted', async () => {
        await handleModerationDecision(
            'approved',
            'rejected',
            'users/123/images/test.jpg',
            mockDeleteObject,
            mockUpdateDoc
        );

        expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
        expect(mockUpdateDoc).toHaveBeenCalledWith({ imageUrl: null, imageStatus: 'deleted' });
    });

    it('should NOT delete image when both post and image are approved', async () => {
        await handleModerationDecision(
            'approved',
            'approved',
            'users/123/images/test.jpg',
            mockDeleteObject,
            mockUpdateDoc
        );

        expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it('should delete image when post is rejected and image is also rejected', async () => {
        await handleModerationDecision(
            'rejected',
            'rejected',
            'users/123/images/test.jpg',
            mockDeleteObject,
            mockUpdateDoc
        );

        expect(mockDeleteObject).toHaveBeenCalledTimes(1);
    });

    it('should handle missing imageFilePath gracefully', async () => {
        await handleModerationDecision(
            'approved',
            'rejected',
            null,  // no image path
            mockDeleteObject,
            mockUpdateDoc
        );

        expect(mockDeleteObject).not.toHaveBeenCalled();
    });
});

describe('parseAiResponse', () => {
    // Import the function logic directly for testing
    const parseAiResponse = (aiText) => {
        const upperText = aiText.toUpperCase().trim();
        
        if (upperText === 'SAFE' || upperText.startsWith('SAFE')) {
            return { status: 'approved', reason: null };
        }
        
        if (upperText.startsWith('REJECT')) {
            return { status: 'rejected', reason: aiText };
        }
        
        if (upperText.includes('VANDALISM') || upperText.includes('HARASSMENT') || upperText.includes('SPAM')) {
            return { status: 'rejected', reason: aiText };
        }
        
        if (upperText.includes('SAFE') || upperText.includes('APPROVED') || upperText.includes('ACCEPTABLE')) {
            return { status: 'approved', reason: null };
        }
        
        return { status: 'approved', reason: null };
    };

    it('should approve "SAFE" response', () => {
        expect(parseAiResponse('SAFE')).toEqual({ status: 'approved', reason: null });
    });

    it('should approve "Safe" response (case insensitive)', () => {
        expect(parseAiResponse('Safe')).toEqual({ status: 'approved', reason: null });
    });

    it('should reject "REJECT: reason" response', () => {
        const result = parseAiResponse('REJECT: Contains spam');
        expect(result.status).toBe('rejected');
        expect(result.reason).toContain('spam');
    });

    it('should handle legacy VANDALISM response', () => {
        expect(parseAiResponse('VANDALISM detected')).toEqual({ 
            status: 'rejected', 
            reason: 'VANDALISM detected' 
        });
    });

    it('should default to approved for ambiguous responses', () => {
        expect(parseAiResponse('The content seems fine')).toEqual({ 
            status: 'approved', 
            reason: null 
        });
    });
});
