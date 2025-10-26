import { parseMasterAndVariantFromRecipeCode } from '../masterRecipeUtils';

describe('parseMasterAndVariantFromRecipeCode', () => {
  it('should correctly parse standard ARKIK code with variant suffix', () => {
    const result = parseMasterAndVariantFromRecipeCode('5-250-2-B-28-14-B-2-PCM');
    expect(result.masterCode).toBe('5-250-2-B-28-14-B');
    expect(result.variantSuffix).toBe('2-PCM');
  });

  it('should parse variant with 000 suffix', () => {
    const result = parseMasterAndVariantFromRecipeCode('5-250-2-B-28-14-B-2-000');
    expect(result.masterCode).toBe('5-250-2-B-28-14-B');
    expect(result.variantSuffix).toBe('2-000');
  });

  it('should parse variant with numeric codes', () => {
    const result = parseMasterAndVariantFromRecipeCode('6-200-2-B-28-10-D-2-000');
    expect(result.masterCode).toBe('6-200-2-B-28-10-D');
    expect(result.variantSuffix).toBe('2-000');
  });

  it('should handle codes with hours instead of days', () => {
    const result = parseMasterAndVariantFromRecipeCode('5-300-2-B-03-18-B-2-PCE');
    expect(result.masterCode).toBe('5-300-2-B-03-18-B');
    expect(result.variantSuffix).toBe('2-PCE');
  });

  it('should handle pavimento codes', () => {
    const result = parseMasterAndVariantFromRecipeCode('PAV-350-4-B-28-18-B-2-000');
    expect(result.masterCode).toBe('PAV-350-4-B-28-18-B');
    expect(result.variantSuffix).toBe('2-000');
  });

  it('should handle codes without sufficient segments', () => {
    const result = parseMasterAndVariantFromRecipeCode('FC150');
    expect(result.masterCode).toBe('FC150');
    expect(result.variantSuffix).toBeNull();
  });

  it('should handle null or empty codes', () => {
    const result1 = parseMasterAndVariantFromRecipeCode('');
    expect(result1.masterCode).toBe('');
    expect(result1.variantSuffix).toBeNull();

    const result2 = parseMasterAndVariantFromRecipeCode(null as any);
    expect(result2.masterCode).toBe('');
    expect(result2.variantSuffix).toBeNull();
  });

  it('should handle codes with special variants', () => {
    const result = parseMasterAndVariantFromRecipeCode('A-450-2-B-28-18-B-2-E20');
    expect(result.masterCode).toBe('A-450-2-B-28-18-B');
    expect(result.variantSuffix).toBe('2-E20');
  });
});

