interface ProcessingStatusProps {
  total: number;
  processed: number;
  errors: string[];
}

export const ProcessingStatus = ({ total, processed, errors }: ProcessingStatusProps) => {
  return (
    <div className="mt-4">
      <div className="mb-2">
        <span className="font-medium">Procesando recetas: </span>
        {processed} de {total}
      </div>
      
      {errors.length > 0 && (
        <div className="mt-2">
          <h3 className="font-medium text-red-600">Errores encontrados:</h3>
          <ul className="list-disc list-inside">
            {errors.map((error, index) => (
              <li key={index} className="text-red-600">{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}; 