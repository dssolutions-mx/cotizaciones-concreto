import RoleValidator from '@/components/auth/RoleValidator';

export default function RoleCheckPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Validación de Roles del Sistema</h1>
      <p className="text-center max-w-2xl mx-auto mb-8 text-gray-600">
        Esta página te permite comprobar que el sistema de permisos basados en roles funciona correctamente.
        Verifica que tu rol tiene los permisos esperados de acuerdo con la matriz de permisos del sistema.
      </p>
      
      <RoleValidator />
      
      <div className="mt-12 bg-white rounded-lg shadow-sm p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Matriz de Permisos del Sistema</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionalidad</th>
                <th className="px-4 py-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SALES_AGENT</th>
                <th className="px-4 py-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">QUALITY_TEAM</th>
                <th className="px-4 py-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PLANT_MANAGER</th>
                <th className="px-4 py-2 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">EXECUTIVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 font-medium">Acceso a Cotizaciones</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Ver Cotizaciones Borrador</td>
                <td className="px-4 py-2 text-center">Solo propias</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Ver Cotizaciones Aprobadas</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Ver Cotizaciones Pendientes</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Crear/Editar Cotización</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Aprobar/Rechazar Cotización</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Editar Precios de Materiales</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Editar Costos Administrativos</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Gestionar Recetas</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Crear/Editar Clientes</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Eliminar Clientes</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Ver Estadísticas</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">❌</td>
                <td className="px-4 py-2 text-center">✅</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 