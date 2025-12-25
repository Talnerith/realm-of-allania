import { NextResponse } from 'next/server';
import packageJson from '@/../package.json';

// In a real build, we might use process.env.NEXT_BUILD_ID or a timestamp generated at build time.
// For now, we'll use the package version + a mock build ID if available, or just the version.
// Using a timestamp of server start is also a decent proxy for "new deployment" in many serverless cases (cold starts),
// but consistent versions are better.

export async function GET() {
    return NextResponse.json({
        version: packageJson.version,
        // If you add a custom build ID env var in Vercel/Next, use it here.
        buildId: process.env.NEXT_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
        timestamp: Date.now()
    });
}
