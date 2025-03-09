/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client with the URL and anon key from env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error - Missing required environment variables' },
        { status: 500 }
      );
    }

    // Create an admin client using the service role key
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the cookie header
    const cookieHeader = request.headers.get('cookie') || '';

    // Extract the project reference from the cookie
    const projectRefMatch = cookieHeader.match(/sb-([a-zA-Z0-9]+)-auth-token/);
    const projectRef = projectRefMatch ? projectRefMatch[1] : null;

    if (!projectRef) {
      return NextResponse.json(
        { error: 'No auth cookie found' },
        { status: 401 }
      );
    }

    // Find and combine all cookie parts
    const tokenRegex = new RegExp(`sb-${projectRef}-auth-token\\.([0-9]+)=([^;]+)`, 'g');
    const tokenParts = [];
    let match;
    
    while ((match = tokenRegex.exec(cookieHeader)) !== null) {
      tokenParts.push({
        index: parseInt(match[1]),
        value: match[2]
      });
    }
    
    if (tokenParts.length === 0) {
      return NextResponse.json(
        { error: 'No auth token parts found' },
        { status: 401 }
      );
    }
    
    // Combine token parts
    let combinedToken = '';
    for (const part of tokenParts) {
      let value = part.value;
      if (value.startsWith('base64-')) {
        value = value.substring(7);
      }
      combinedToken += value;
    }
    
    // Extract user info from token
    let userId = null;
    let userEmail = null;
    
    try {
      try {
        const decoded = Buffer.from(combinedToken, 'base64').toString();
        const tokenData = JSON.parse(decoded);
        userId = tokenData.user?.id;
        userEmail = tokenData.user?.email;
      } catch (_error) {
        // If parsing fails, try regex
        const userIdMatch = combinedToken.match(/"id":"([a-f0-9-]+)"/);
        userId = userIdMatch ? userIdMatch[1] : null;
        
        const emailMatch = combinedToken.match(/"email":"([^"]+)"/);
        userEmail = emailMatch ? emailMatch[1] : null;
      }
    } catch (error: unknown) {
      console.error('Error parsing auth token:', error);
      return NextResponse.json(
        { error: 'Failed to parse auth token' },
        { status: 400 }
      );
    }
    
    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Could not determine user ID or email from token' },
        { status: 400 }
      );
    }

    // Get profile data from request
    const { firstName, lastName, role } = await request.json();
    
    // Check if the user already has a profile
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (existingProfile) {
      return NextResponse.json(
        { message: 'User profile already exists', profile: existingProfile },
        { status: 200 }
      );
    }
    
    // Create the user profile
    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: userId,
        email: userEmail,
        first_name: firstName || null,
        last_name: lastName || null,
        role: role || 'SALES_AGENT', // Default role
        is_active: true
      })
      .select();
      
    if (profileError) {
      console.error('Error creating user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to create user profile', details: profileError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      profile: newProfile[0]
    });
    
  } catch (error: unknown) {
    console.error('Error in create-profile API route:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 