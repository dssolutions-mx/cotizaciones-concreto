/**
 * Standardized utility functions for recipe code handling
 * 
 * This module provides consistent normalization, validation, and matching
 * logic for recipe codes across all Arkik validators to prevent mismatches.
 */

/**
 * Standardized recipe code normalization
 * 
 * This function ensures all recipe codes are normalized consistently
 * across the entire application.
 * 
 * @param code - The recipe code to normalize
 * @returns Normalized recipe code
 */
export function normalizeRecipeCode(code: string): string {
  if (!code) return '';
  
  return code
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/-/g, '');  // Remove all hyphens
}

/**
 * Validate recipe code format
 * 
 * Checks if a recipe code follows the expected format pattern.
 * Expected format: X-XXX-X-X-XX-XX-X-X-XXX (numbers and letters with hyphens)
 * 
 * @param code - The recipe code to validate
 * @returns True if format is valid
 */
export function validateRecipeCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  // Basic pattern: should contain numbers, letters, and hyphens
  // More specific pattern can be added based on business rules
  const basicPattern = /^[0-9A-Za-z\-]+$/;
  const hasNumbers = /\d/.test(code);
  const hasLetters = /[A-Za-z]/.test(code);
  const hasHyphens = /-/.test(code);
  
  return basicPattern.test(code) && hasNumbers && hasLetters && hasHyphens && code.length >= 5;
}

/**
 * Strict recipe code matching
 * 
 * Only allows exact matches after normalization.
 * This prevents incorrect matching of similar but different recipe codes.
 * 
 * @param code1 - First recipe code
 * @param code2 - Second recipe code
 * @returns True if codes match exactly after normalization
 */
export function exactRecipeMatch(code1: string, code2: string): boolean {
  if (!code1 || !code2) return false;
  
  const normalized1 = normalizeRecipeCode(code1);
  const normalized2 = normalizeRecipeCode(code2);
  
  return normalized1 === normalized2;
}

/**
 * Conservative fuzzy matching for recipe codes
 * 
 * Only allows very minor differences (1 character) and only for
 * obvious typos, not for different recipe specifications.
 * 
 * WARNING: Use with extreme caution. Consider disabling fuzzy matching
 * entirely for production systems to prevent data integrity issues.
 * 
 * @param input - Input recipe code
 * @param target - Target recipe code to match against
 * @returns True if codes match with very minor differences
 */
export function conservativeFuzzyRecipeMatch(input: string, target: string): boolean {
  if (!input || !target) return false;
  
  // First try exact match
  if (exactRecipeMatch(input, target)) return true;
  
  const normalized1 = normalizeRecipeCode(input);
  const normalized2 = normalizeRecipeCode(target);
  
  // Only allow 1 character difference for very minor typos
  // This is still risky - consider disabling entirely
  const distance = levenshteinDistance(normalized1, normalized2);
  
  // Additional safety: codes must be similar length (within 1 character)
  const lengthDiff = Math.abs(normalized1.length - normalized2.length);
  
  return distance === 1 && lengthDiff <= 1;
}

/**
 * Levenshtein distance calculation
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance between strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Find recipe by trying multiple matching strategies
 * 
 * @param inputCode - The recipe code from the input data
 * @param recipes - Array of available recipes
 * @param allowFuzzyMatch - Whether to allow conservative fuzzy matching (default: false)
 * @returns Matching recipe or null
 */
export function findRecipeMatch(
  inputCode: string, 
  recipes: any[], 
  allowFuzzyMatch: boolean = false
): any | null {
  if (!inputCode || !recipes || recipes.length === 0) return null;
  
  // Strategy 1: Exact match on arkik_long_code
  let match = recipes.find(recipe => 
    recipe.arkik_long_code && exactRecipeMatch(inputCode, recipe.arkik_long_code)
  );
  if (match) return match;
  
  // Strategy 2: Exact match on recipe_code
  match = recipes.find(recipe => 
    recipe.recipe_code && exactRecipeMatch(inputCode, recipe.recipe_code)
  );
  if (match) return match;
  
  // Strategy 3: Exact match on arkik_short_code
  match = recipes.find(recipe => 
    recipe.arkik_short_code && exactRecipeMatch(inputCode, recipe.arkik_short_code)
  );
  if (match) return match;
  
  // Strategy 4: Conservative fuzzy matching (if enabled)
  if (allowFuzzyMatch) {
    const candidates = recipes.filter(recipe => {
      const codes = [recipe.arkik_long_code, recipe.recipe_code, recipe.arkik_short_code]
        .filter(Boolean);
      
      return codes.some(code => conservativeFuzzyRecipeMatch(inputCode, code));
    });
    
    // Only return if exactly one candidate to avoid ambiguity
    if (candidates.length === 1) {
      return candidates[0];
    }
  }
  
  return null;
}

/**
 * Get recipe code suggestions for manual review
 * 
 * When no exact match is found, provide similar codes for manual review
 * without automatically matching them.
 * 
 * @param inputCode - The input recipe code
 * @param recipes - Array of available recipes
 * @param maxSuggestions - Maximum number of suggestions (default: 5)
 * @returns Array of similar recipe codes
 */
export function getRecipeCodeSuggestions(
  inputCode: string, 
  recipes: any[], 
  maxSuggestions: number = 5
): string[] {
  if (!inputCode || !recipes || recipes.length === 0) return [];
  
  const normalizedInput = normalizeRecipeCode(inputCode);
  
  const suggestions = recipes
    .map(recipe => {
      const codes = [recipe.arkik_long_code, recipe.recipe_code, recipe.arkik_short_code]
        .filter(Boolean);
      
      return codes.map(code => ({
        code,
        distance: levenshteinDistance(normalizedInput, normalizeRecipeCode(code))
      }));
    })
    .flat()
    .filter(item => item.distance <= 3) // Only suggest codes with reasonable similarity
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions)
    .map(item => item.code);
  
  // Remove duplicates
  return [...new Set(suggestions)];
}
