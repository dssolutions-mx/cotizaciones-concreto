import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client with the URL and service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get request body
    const { password, userId } = await request.json();
    
    if (!password || !userId) {
      console.error('Missing required fields for password update');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create admin client
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

    // Verify the user exists and is active
    const { data: user, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, is_active')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error verifying user:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.is_active === false) {
      return NextResponse.json(
        { error: 'User account is inactive' },
        { status: 403 }
      );
    }

    // Update the user's password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Update user metadata
    await supabaseAdmin
      .from('user_profiles')
      .update({
        last_password_update: new Date().toISOString()
      })
      .eq('id', userId);

    return NextResponse.json({ 
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in password update:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 