'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function UserManagementExample() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Form state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('SALES_AGENT');
  const [password, setPassword] = useState('');
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    
    try {
      // Create user API request with caller information
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          role,
          password: password || undefined,
          // Pass caller information to help with authentication
          callerId: user?.id,
          callerEmail: user?.email
        }),
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        // Clear form on success
        setEmail('');
        setFirstName('');
        setLastName('');
        setPassword('');
      }
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setResult(null);
    
    try {
      // Invite user API request with caller information
      const response = await fetch('/api/auth/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          role,
          // Pass caller information to help with authentication
          callerId: user?.id,
          callerEmail: user?.email
        }),
      });
      
      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        // Clear form on success
        setEmail('');
      }
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setInviteLoading(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New User</h2>
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block mb-1">Email:</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          
          <div>
            <label className="block mb-1">First Name:</label>
            <input 
              type="text" 
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block mb-1">Last Name:</label>
            <input 
              type="text" 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block mb-1">Password (optional):</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="Leave blank to generate a random password"
            />
          </div>
          
          <div>
            <label className="block mb-1">Role:</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="SALES_AGENT">Sales Agent</option>
              <option value="PLANT_MANAGER">Plant Manager</option>
              <option value="QUALITY_TEAM">Quality Team</option>
              <option value="EXECUTIVE">Executive</option>
            </select>
          </div>
          
          <div className="flex space-x-4">
            <button 
              type="submit" 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              disabled={loading || !email}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
            
            <button 
              type="button" 
              onClick={handleInviteUser}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              disabled={inviteLoading || !email}
            >
              {inviteLoading ? 'Inviting...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
      
      {result && (
        <div className={`p-4 rounded mt-4 ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
          <h3 className="font-bold mb-2">{result.success ? 'Success!' : 'Error!'}</h3>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="mt-6 p-4 bg-gray-100 rounded text-sm">
        <p className="mb-2"><strong>Note:</strong> This component passes your user ID and email in the request body as <code>callerId</code> and <code>callerEmail</code>.</p>
        <p>This allows the API to work even if cookies are not properly set or accessible by the server.</p>
      </div>
    </div>
  );
} 