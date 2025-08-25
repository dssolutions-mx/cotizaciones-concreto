export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: string;
  business_unit_id: string;
  code: string;
  name: string;
  location?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  business_unit?: BusinessUnit;
}

export interface UserPlantAccess {
  userId: string;
  plantId?: string;
  businessUnitId?: string;
  accessLevel: 'PLANT' | 'BUSINESS_UNIT' | 'GLOBAL';
}

export interface PlantContextType {
  currentPlant: Plant | null;
  availablePlants: Plant[];
  businessUnits: BusinessUnit[];
  userAccess: UserPlantAccess | null;
  isGlobalAdmin: boolean;
  switchPlant: (plantId: string) => void;
  switchBusinessUnit: (businessUnitId: string) => void;
  refreshPlantData: () => Promise<void>;
  isLoading: boolean;
} 