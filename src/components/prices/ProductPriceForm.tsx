import { useState, useEffect } from 'react';
import { priceService } from '@/lib/supabase/prices';
import { recipeService } from '@/lib/supabase/recipes';
import { calculateBasePrice } from '@/lib/utils/priceCalculator';

interface ProductPriceFormData {
  code: string;
  description: string;
  fc_mr_value: number;
  type: 'FC' | 'MR';
  age_days: number;
  placement_type: 'D' | 'B';
  max_aggregate_size: number;
  slump: number;
  base_price: number;
  recipe_id: string;
  effective_date: string;
}

interface Recipe {
  id: string;
  recipe_code: string;
  strength_fc: number;
  age_days: number;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  recipe_versions: {
    id: string;
    version_number: number;
    materials?: {
      material_type: string;
      quantity: number;
      unit: string;
    }[];
  }[];
}

interface ProductPriceFormProps {
  onProductSaved?: () => void;
}

export const ProductPriceForm = ({ onProductSaved }: ProductPriceFormProps) => {
  const [formData, setFormData] = useState<ProductPriceFormData>({
    code: '',
    description: '',
    fc_mr_value: 0,
    type: 'FC',
    age_days: 28,
    placement_type: 'D',
    max_aggregate_size: 0,
    slump: 0,
    base_price: 0,
    recipe_id: '',
    effective_date: new Date().toISOString().split('T')[0]
  });

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Cargar recetas disponibles
  useEffect(() => {
    const loadRecipes = async () => {
      try {
        const { data, error } = await recipeService.getRecipes();
        if (error) throw error;
        setRecipes(data || []);
      } catch (err: any) {
        setError('Error al cargar las recetas: ' + err.message);
      }
    };

    loadRecipes();
  }, []);

  // Actualizar campos cuando se selecciona una receta
  const handleRecipeChange = async (recipeId: string) => {
    try {
      setFormData(prev => ({ ...prev, recipe_id: recipeId }));
      setIsCalculating(true);
      
      if (!recipeId) return;

      const { data: recipe, error } = await recipeService.getRecipeById(recipeId);
      if (error) throw error;

      if (recipe) {
        // Calcular precio base usando los materiales de la versión actual
        const currentVersion = recipe.recipe_versions[0];
        const basePrice = await calculateBasePrice(
          recipeId, 
          currentVersion.materials || []
        );

        setFormData(prev => ({
          ...prev,
          fc_mr_value: recipe.strength_fc,
          age_days: recipe.age_days,
          placement_type: recipe.placement_type as 'D' | 'B',
          max_aggregate_size: recipe.max_aggregate_size,
          slump: recipe.slump,
          base_price: basePrice
        }));
      }
    } catch (err: any) {
      setError('Error al cargar los detalles de la receta: ' + err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.code.trim()) {
      setError('El código es requerido');
      return;
    }

    if (!formData.description.trim()) {
      setError('La descripción es requerida');
      return;
    }

    if (formData.fc_mr_value <= 0) {
      setError('El valor de resistencia debe ser mayor a 0');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Map form data to match the expected structure
      const productPriceData = {
        code: formData.code,
        description: formData.description,
        fcMrValue: formData.fc_mr_value,
        type: formData.type,
        ageDays: formData.age_days,
        placementType: formData.placement_type,
        maxAggregateSize: formData.max_aggregate_size,
        slump: formData.slump,
        basePrice: formData.base_price,
        recipeId: formData.recipe_id,
        effectiveDate: formData.effective_date
      };
      
      const { error: supabaseError } = await priceService.saveProductPrice(productPriceData);
      
      if (supabaseError) throw supabaseError;

      setSuccess(true);
      setFormData({
        ...formData,
        code: '',
        description: '',
        fc_mr_value: 0,
        base_price: 0,
        recipe_id: ''
      });

      onProductSaved?.();

      setTimeout(() => setSuccess(false), 3000);

    } catch (err: any) {
      setError(err.message || 'Error al guardar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Registrar Precio de Producto</h3>
      
      {error && (
        <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-600 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 text-green-600 rounded">
          Producto guardado exitosamente
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Código</label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData({...formData, code: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value as 'FC' | 'MR'})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          >
            <option value="FC">FC</option>
            <option value="MR">MR</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Descripción</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {formData.type === 'FC' ? 'f\'c (kg/cm²)' : 'MR (kg/cm²)'}
          </label>
          <input
            type="number"
            value={formData.fc_mr_value}
            onChange={(e) => setFormData({...formData, fc_mr_value: parseInt(e.target.value)})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Edad (días)</label>
          <input
            type="number"
            value={formData.age_days}
            onChange={(e) => setFormData({...formData, age_days: parseInt(e.target.value)})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Receta Base</label>
          <select
            value={formData.recipe_id}
            onChange={(e) => handleRecipeChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          >
            <option value="">Seleccionar receta</option>
            {recipes.map(recipe => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.recipe_code} - {recipe.strength_fc} kg/cm²
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo de Colocación</label>
          <select
            value={formData.placement_type}
            onChange={(e) => setFormData({...formData, placement_type: e.target.value as 'D' | 'B'})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          >
            <option value="D">Directo</option>
            <option value="B">Bombeado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">TMA (pulgadas)</label>
          <input
            type="number"
            step="0.25"
            min="0"
            value={formData.max_aggregate_size}
            onChange={(e) => setFormData({...formData, max_aggregate_size: parseFloat(e.target.value)})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Revenimiento (cm)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={formData.slump}
            onChange={(e) => setFormData({...formData, slump: parseInt(e.target.value)})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Precio Base</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.base_price}
              onChange={(e) => setFormData({...formData, base_price: parseFloat(e.target.value)})}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
              disabled={isSubmitting || isCalculating}
            />
            {isCalculating && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
              </div>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Calculado automáticamente según receta y precios actuales
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha Efectiva</label>
          <input
            type="date"
            value={formData.effective_date}
            onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="md:col-span-2 w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Producto'}
        </button>
      </div>
    </form>
  );
}; 