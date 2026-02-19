import { parseArkikCodeToSpecs } from '../arkikCodeParser';

describe('parseArkikCodeToSpecs', () => {
  it('should parse standard FC code 5-250-2-B-28-14-B-2-000', () => {
    const result = parseArkikCodeToSpecs('5-250-2-B-28-14-B-2-000');
    expect(result).not.toBeNull();
    expect(result!.specification.strength_fc).toBe(250);
    expect(result!.specification.age_days).toBe(28);
    expect(result!.specification.age_hours).toBeUndefined();
    expect(result!.specification.slump).toBe(14);
    expect(result!.specification.placement_type).toBe('BOMBEADO');
    expect(result!.specification.max_aggregate_size).toBe(20); // TMA factor 2 → 20mm
    expect(result!.specification.recipe_type).toBe('FC');
    expect(result!.masterCode).toBe('5-250-2-B-28-14-B');
    expect(result!.variantSuffix).toBe('2-000');
  });

  it('should parse standard code 6-200-2-B-28-10-D-2-000', () => {
    const result = parseArkikCodeToSpecs('6-200-2-B-28-10-D-2-000');
    expect(result).not.toBeNull();
    expect(result!.specification.strength_fc).toBe(200);
    expect(result!.specification.slump).toBe(10);
    expect(result!.specification.placement_type).toBe('DIRECTO');
    expect(result!.specification.recipe_type).toBe('FC');
    expect(result!.masterCode).toBe('6-200-2-B-28-10-D');
  });

  it('should parse PAV (legacy) as MR', () => {
    const result = parseArkikCodeToSpecs('PAV-350-4-B-28-18-B-2-000');
    expect(result).not.toBeNull();
    expect(result!.specification.strength_fc).toBe(350);
    expect(result!.specification.recipe_type).toBe('MR');
    expect(result!.specification.max_aggregate_size).toBe(40); // TMA factor 4
    expect(result!.masterCode).toBe('PAV-350-4-B-28-18-B');
    expect(result!.variantSuffix).toBe('2-000');
  });

  it('should parse P prefix as MR', () => {
    const result = parseArkikCodeToSpecs('P-250-2-B-28-14-B-2-000');
    expect(result).not.toBeNull();
    expect(result!.specification.recipe_type).toBe('MR');
  });

  it('should interpret age 03 as hours (3h)', () => {
    const result = parseArkikCodeToSpecs('5-300-2-B-03-18-B-2-PCE');
    expect(result).not.toBeNull();
    expect(result!.specification.age_days).toBe(0);
    expect(result!.specification.age_hours).toBe(3);
  });

  it('should interpret age 14 as days', () => {
    const result = parseArkikCodeToSpecs('5-250-2-B-14-12-D-2-000');
    expect(result).not.toBeNull();
    expect(result!.specification.age_days).toBe(14);
    expect(result!.specification.age_hours).toBeUndefined();
  });

  it('should map TMA factor 0 to 6mm', () => {
    const result = parseArkikCodeToSpecs('5-250-0-B-28-14-B-2-000');
    expect(result).not.toBeNull();
    expect(result!.specification.max_aggregate_size).toBe(6);
  });

  it('should map TMA factor 1 to 13mm', () => {
    const result = parseArkikCodeToSpecs('5-250-1-B-28-14-B-2-000');
    expect(result).not.toBeNull();
    expect(result!.specification.max_aggregate_size).toBe(13);
  });

  it('should return null for codes with insufficient segments', () => {
    const result = parseArkikCodeToSpecs('FC150');
    expect(result).toBeNull();
  });

  it('should return null for empty or null', () => {
    expect(parseArkikCodeToSpecs('')).toBeNull();
    expect(parseArkikCodeToSpecs(null as any)).toBeNull();
  });

  it('should handle code with variant 2-PCM', () => {
    const result = parseArkikCodeToSpecs('5-250-2-B-28-14-B-2-PCM');
    expect(result).not.toBeNull();
    expect(result!.variantSuffix).toBe('2-PCM');
  });
});
