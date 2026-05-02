/** QUALITY_TEAM users scoped to certain plants (nav + page gating). */
export function isQualityTeamInRestrictedPlant(
  userRole: string | undefined,
  plantCode: string | undefined
): boolean {
  if (userRole !== 'QUALITY_TEAM') return false;
  const restrictedPlants = ['P2', 'P3', 'P4', 'P002', 'P003', 'P004'];
  return plantCode ? restrictedPlants.includes(plantCode) : false;
}
