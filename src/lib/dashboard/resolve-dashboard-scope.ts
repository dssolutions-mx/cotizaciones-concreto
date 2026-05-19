import type { UserProfile } from '@/store/auth/types';
import type { BusinessUnit, Plant, UserPlantAccess } from '@/types/plant';

export type DashboardScope =
  | {
      accessLevel: 'PLANT';
      plants: Plant[];
      businessUnit: BusinessUnit | null;
      scopeLabel: string;
    }
  | {
      accessLevel: 'BUSINESS_UNIT';
      plants: Plant[];
      businessUnit: BusinessUnit | null;
      scopeLabel: string;
    }
  | {
      accessLevel: 'GLOBAL';
      plants: Plant[];
      businessUnit: BusinessUnit | null;
      scopeLabel: string;
    };

export function resolveDashboardScope(
  profile: UserProfile | null | undefined,
  userAccess: UserPlantAccess | null,
  availablePlants: Plant[],
  businessUnits: BusinessUnit[],
  currentPlant: Plant | null,
  isGlobalAdmin: boolean
): DashboardScope {
  const activePlants = availablePlants.filter((p) => p.code !== 'DIACE' && p.is_active);

  if (profile?.plant_id) {
    const plant = activePlants.find((p) => p.id === profile.plant_id) ?? currentPlant;
    const bu = plant?.business_unit_id
      ? businessUnits.find((b) => b.id === plant.business_unit_id) ?? null
      : null;
    return {
      accessLevel: 'PLANT',
      plants: plant ? [plant] : [],
      businessUnit: bu,
      scopeLabel: plant ? `Planta ${plant.name}` : 'Tu planta',
    };
  }

  if (profile?.business_unit_id) {
    const buPlants = activePlants.filter((p) => p.business_unit_id === profile.business_unit_id);
    const bu = businessUnits.find((b) => b.id === profile.business_unit_id) ?? null;
    const plantNames = buPlants.map((p) => p.name).join(' · ');
    return {
      accessLevel: 'BUSINESS_UNIT',
      plants: buPlants,
      businessUnit: bu,
      scopeLabel: bu
        ? `${bu.name}${plantNames ? ` — ${plantNames}` : ''}`
        : plantNames || 'Tu unidad de negocio',
    };
  }

  if (isGlobalAdmin || userAccess?.accessLevel === 'GLOBAL') {
    const bu = currentPlant?.business_unit_id
      ? businessUnits.find((b) => b.id === currentPlant.business_unit_id) ?? null
      : null;
    return {
      accessLevel: 'GLOBAL',
      plants: activePlants,
      businessUnit: bu,
      scopeLabel: currentPlant
        ? `${currentPlant.name}${bu ? ` · ${bu.name}` : ''}`
        : 'Todas las plantas',
    };
  }

  return {
    accessLevel: 'PLANT',
    plants: currentPlant ? [currentPlant] : activePlants.slice(0, 1),
    businessUnit: null,
    scopeLabel: currentPlant?.name ?? 'Dashboard',
  };
}
