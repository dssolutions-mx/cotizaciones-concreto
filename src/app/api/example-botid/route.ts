import { checkBotId } from 'botid/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Example API route demonstrating BotID server-side verification
 * 
 * This route shows how to protect an API endpoint using BotID.
 * The route must be included in the protectedRoutes array in layout.tsx
 * for BotID to attach the necessary headers.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is not from a bot
    const verification = await checkBotId();

    if (verification.isBot) {
      return NextResponse.json(
        { error: 'Access denied: Bot detected' },
        { status: 403 }
      );
    }

    // If verification passes, proceed with your business logic
    const body = await request.json();
    
    // Your business logic here
    return NextResponse.json({
      success: true,
      message: 'Request processed successfully',
      data: body,
    });
  } catch (error) {
    console.error('BotID verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
