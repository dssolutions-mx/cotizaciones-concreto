'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ApiResponse {
  success: boolean;
  message: string;
  session?: unknown;
  user?: unknown;
  [key: string]: unknown;
}

export default function AuthCheckPage() {
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [adminApiResponse, setAdminApiResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const { user, userProfile, session, isAuthenticated } = useAuth();

  const checkSession = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      if (user?.id) queryParams.append('userId', user.id);
      if (user?.email) queryParams.append('email', user.email);
      
      const response = await fetch(`/api/auth/check-session?${queryParams.toString()}`);
      const data = await response.json();
      
      setApiResponse(data);
    } catch (err: unknown) {
      console.error('Error checking session:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error checking session: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const checkAdminApi = async () => {
    try {
      setAdminLoading(true);
      setAdminError(null);
      
      const queryParams = new URLSearchParams();
      if (user?.id) queryParams.append('userId', user.id);
      if (user?.email) queryParams.append('email', user.email);
      
      const response = await fetch(`/api/auth/test-admin?${queryParams.toString()}`);
      const data = await response.json();
      
      setAdminApiResponse(data);
    } catch (err: unknown) {
      console.error('Error checking admin API:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setAdminError(`Error checking admin API: ${errorMessage}`);
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Authentication Status Check</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Client-Side Auth State</h2>
        <div className="space-y-2">
          <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
          <p><strong>User ID:</strong> {user?.id || 'Not logged in'}</p>
          <p><strong>User Email:</strong> {user?.email || 'Not available'}</p>
          <p><strong>User Role:</strong> {userProfile?.role || 'Not available'}</p>
          <p><strong>Session:</strong> {session ? 'Active' : 'None'}</p>
        </div>
      </div>
      
      <div className="mb-6 flex space-x-4">
        <button 
          onClick={checkSession}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Session API'}
        </button>
        
        <button 
          onClick={checkAdminApi}
          disabled={adminLoading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {adminLoading ? 'Checking...' : 'Test Admin API'}
        </button>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          <h2 className="font-semibold">Error:</h2>
          <p>{error}</p>
        </div>
      )}
      
      {apiResponse && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Session API Response</h2>
          <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto">
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </div>
      )}
      
      {adminError && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          <h2 className="font-semibold">Admin API Error:</h2>
          <p>{adminError}</p>
        </div>
      )}
      
      {adminApiResponse && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Admin API Response</h2>
          <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto">
            {JSON.stringify(adminApiResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 