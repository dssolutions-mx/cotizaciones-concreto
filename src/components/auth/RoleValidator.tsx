'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_TEST_CASES, validateRoleChecks, ROLE_DESCRIPTIONS } from '@/lib/auth/roleUtils';

export default function RoleValidator() {
  const { userProfile, hasRole } = useAuth();
  const [showResults, setShowResults] = useState(false);
  const [testResults, setTestResults] = useState<ReturnType<typeof validateRoleChecks> | null>(null);
  
  const runTests = () => {
    const results = validateRoleChecks();
    setTestResults(results);
    setShowResults(true);
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto my-8">
      <h2 className="text-2xl font-bold mb-4">Validador de Permisos de Rol</h2>
      
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium mb-2">Tu Rol Actual</h3>
        {userProfile ? (
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {ROLE_DESCRIPTIONS[userProfile.role]}
            </span>
            <span className="text-gray-600">({userProfile.role})</span>
          </div>
        ) : (
          <p className="text-red-600">No has iniciado sesión o no se ha cargado tu perfil.</p>
        )}
      </div>
      
      <div className="flex justify-center mb-6">
        <button
          onClick={runTests}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Probar Permisos de Roles
        </button>
      </div>
      
      {showResults && testResults && (
        <div className="mt-6">
          <div className="flex justify-between mb-4">
            <h3 className="text-xl font-semibold">Resultados de las Pruebas</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              testResults.passRate === '100.0%' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              Tasa de éxito: {testResults.passRate}
            </span>
          </div>
          
          {testResults.failed.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-lg font-semibold text-red-700 mb-2">Pruebas Fallidas ({testResults.failed.length})</h4>
              <ul className="space-y-2">
                {testResults.failed.map((test, index) => (
                  <li key={`failed-${index}`} className="text-red-700">
                    El rol <strong>{test.role}</strong> debería {test.expected ? 'poder' : 'NO poder'} {test.action}
                    {' '} (Roles permitidos: {test.allowedRoles.join(', ')})
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <h4 className="text-lg font-semibold mb-3">Pruebas para tu Rol Actual</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
                  <th className="px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles Permitidos</th>
                  <th className="px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expectativa</th>
                  <th className="px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {userProfile && ROLE_TEST_CASES
                  .filter(test => test.role === userProfile.role)
                  .map((test, index) => {
                    const actualResult = hasRole(test.allowedRoles);
                    const isCorrect = actualResult === test.expected;
                    
                    return (
                      <tr key={`test-${index}`}>
                        <td className="px-4 py-2">{test.action}</td>
                        <td className="px-4 py-2">{test.allowedRoles.join(', ')}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${test.expected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {test.expected ? 'Permitido' : 'Denegado'}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isCorrect ? '✓ Correcto' : '✗ Incorrecto'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 