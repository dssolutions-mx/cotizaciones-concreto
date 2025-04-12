'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface SessionInfo {
  hasSession: boolean;
  user: {
    id: string;
    email: string | null;
    lastSignInAt: string | null;
    createdAt: string | null;
  } | null;
  expiresAt: string | null;
  tokenType: string | null;
}

interface UpdateResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string | null;
    updatedAt: string;
  } | null;
}

export default function AuthCheckPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  const [testPassword, setTestPassword] = useState('');

  useEffect(() => {
    async function checkAuth() {
      try {
        setLoading(true);
        
        // Get current session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setError(error.message);
          return;
        }
        
        // Format session data for display
        setSessionInfo({
          hasSession: !!data.session,
          user: data.session?.user ? {
            id: data.session.user.id,
            email: data.session.user.email || null,
            lastSignInAt: data.session.user.last_sign_in_at || null,
            createdAt: data.session.user.created_at || null,
          } : null,
          expiresAt: data.session?.expires_at 
            ? new Date(data.session.expires_at * 1000).toISOString() 
            : null,
          tokenType: data.session?.token_type || null,
        });
        
      } catch (err) {
        console.error('Unexpected error checking auth:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    checkAuth();
  }, []);
  
  const handleTestPasswordUpdate = async () => {
    if (!testPassword || testPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Test password update
      const { data, error } = await supabase.auth.updateUser({
        password: testPassword
      });
      
      if (error) {
        console.error('Error updating password:', error);
        setError(error.message);
        setUpdateResult({ success: false, error: error.message });
        return;
      }
      
      console.log('Password update successful:', data);
      setUpdateResult({ 
        success: true, 
        user: data.user ? {
          id: data.user.id,
          email: data.user.email || null,
          updatedAt: new Date().toISOString()
        } : null 
      });
      
      // Refresh session info
      const { data: sessionData } = await supabase.auth.getSession();
      setSessionInfo({
        hasSession: !!sessionData.session,
        user: sessionData.session?.user ? {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email || null,
          lastSignInAt: sessionData.session.user.last_sign_in_at || null,
          createdAt: sessionData.session.user.created_at || null,
        } : null,
        expiresAt: sessionData.session?.expires_at 
          ? new Date(sessionData.session.expires_at * 1000).toISOString() 
          : null,
        tokenType: sessionData.session?.token_type || null,
      });
      
    } catch (err) {
      console.error('Unexpected error updating password:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setUpdateResult({ success: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Authentication Check</h1>
      
      {loading && (
        <div className="flex items-center justify-center p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      )}
      
      {error && (
        <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {sessionInfo && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Session Information</h2>
          <div className="bg-gray-100 p-4 rounded-md overflow-x-auto">
            <pre className="text-sm">{JSON.stringify(sessionInfo, null, 2)}</pre>
          </div>
        </div>
      )}
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Password Update</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="testPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Test Password
            </label>
            <input
              id="testPassword"
              type="password"
              value={testPassword}
              onChange={(e) => setTestPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter test password"
              disabled={loading}
            />
          </div>
          <button
            onClick={handleTestPasswordUpdate}
            disabled={loading || !testPassword}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Update'}
          </button>
        </div>
        
        {updateResult && (
          <div className={`mt-4 p-4 rounded-md ${updateResult.success ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
            <p className="font-bold">{updateResult.success ? 'Success:' : 'Error:'}</p>
            <div className="mt-2 overflow-x-auto">
              <pre className="text-sm">{JSON.stringify(updateResult, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
        <p className="text-sm text-gray-600 mb-2">
          Browser URL: <code className="bg-gray-100 px-1">{typeof window !== 'undefined' ? window.location.href : 'N/A'}</code>
        </p>
        <p className="text-sm text-gray-600 mb-2">
          URL Hash: <code className="bg-gray-100 px-1">{typeof window !== 'undefined' ? window.location.hash : 'N/A'}</code>
        </p>
        <p className="text-sm text-gray-600">
          User Agent: <code className="bg-gray-100 px-1">{typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</code>
        </p>
      </div>
    </div>
  );
} 