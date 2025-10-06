import { createClient } from '@supabase/supabase-js';

// Test script to verify auth flow is working correctly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zxfmfvgkzbikzvrsmiid.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4Zm1mdmdremJpa3p2cnNtaWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQyNTI3MDksImV4cCI6MjAyOTgyODcwOX0.BMJ2wvTAjWFIrjEXRjZMXCkRCCkqh_9gwhPGQYjHGRQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log('🔍 Testing Auth Flow...\n');
  
  // Test credentials (replace with valid test user)
  const email = 'test@example.com';
  const password = 'test123';
  
  console.log('1️⃣ Attempting sign in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.error('❌ Sign in failed:', authError.message);
    console.log('\n⚠️  Please update the test credentials with a valid user');
    return;
  }
  
  console.log('✅ Sign in successful');
  console.log('   User ID:', authData.session?.user.id);
  console.log('   Email:', authData.session?.user.email);
  
  // Check profile
  console.log('\n2️⃣ Fetching profile...');
  const { data: profileData, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', authData.session.user.id)
    .single();
  
  if (profileError) {
    console.error('❌ Profile fetch failed:', profileError.message);
    return;
  }
  
  if (!profileData) {
    console.error('❌ No profile found for user');
    return;
  }
  
  console.log('✅ Profile loaded successfully');
  console.log('   Role:', profileData.role);
  console.log('   Name:', profileData.first_name, profileData.last_name);
  
  // Determine redirect target
  let target = '/dashboard';
  switch (profileData.role) {
    case 'EXTERNAL_CLIENT':
      target = '/client-portal';
      break;
    case 'QUALITY_TEAM':
      target = '/quality/muestreos';
      break;
    case 'LABORATORY':
    case 'PLANT_MANAGER':
      target = '/quality';
      break;
  }
  
  console.log('\n3️⃣ Redirect target based on role:', target);
  
  // Test session refresh
  console.log('\n4️⃣ Testing session refresh...');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('❌ Session refresh failed:', sessionError.message);
  } else if (!sessionData.session) {
    console.error('❌ No session found after sign in');
  } else {
    console.log('✅ Session is valid and can be refreshed');
    console.log('   Expires at:', new Date(sessionData.session.expires_at * 1000).toLocaleString());
  }
  
  // Sign out
  console.log('\n5️⃣ Signing out...');
  await supabase.auth.signOut();
  console.log('✅ Sign out successful');
  
  console.log('\n🎉 Auth flow test complete!');
  console.log('   All systems should be working correctly.');
  console.log('   If you\'re still experiencing issues, check:');
  console.log('   - Browser console for errors');
  console.log('   - Network tab for failed requests');
  console.log('   - localStorage for auth-store data');
}

testAuth().catch(console.error);
