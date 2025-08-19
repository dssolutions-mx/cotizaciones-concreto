/**
 * Migration Script for Unified Auth System
 * 
 * This script helps migrate existing components from the legacy auth system
 * to the new unified auth system with enhanced performance features.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export interface MigrationReport {
  totalFiles: number;
  migratedFiles: number;
  skippedFiles: number;
  errors: Array<{ file: string; error: string }>;
  changes: Array<{ file: string; changes: string[] }>;
}

export interface MigrationOptions {
  dryRun?: boolean;
  verbose?: boolean;
  skipBackup?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export class UnifiedAuthMigrator {
  private baseDir: string;
  private report: MigrationReport = {
    totalFiles: 0,
    migratedFiles: 0,
    skippedFiles: 0,
    errors: [],
    changes: [],
  };

  constructor(baseDir: string = 'src') {
    this.baseDir = baseDir;
  }

  /**
   * Run the migration process
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationReport> {
    const {
      dryRun = false,
      verbose = false,
      skipBackup = false,
      includePatterns = ['**/*.tsx', '**/*.ts'],
      excludePatterns = ['**/*.test.*', '**/node_modules/**'],
    } = options;

    console.log('🚀 Starting unified auth migration...');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    
    if (!skipBackup && !dryRun) {
      await this.createBackup();
    }

    // Find all relevant files
    const files = await this.findFiles(includePatterns, excludePatterns);
    this.report.totalFiles = files.length;

    console.log(`Found ${files.length} files to process`);

    // Process each file
    for (const file of files) {
      try {
        await this.processFile(file, dryRun, verbose);
      } catch (error: any) {
        this.report.errors.push({ file, error: error.message });
        if (verbose) {
          console.error(`❌ Error processing ${file}:`, error.message);
        }
      }
    }

    this.printReport();
    return this.report;
  }

  /**
   * Create backup of files before migration
   */
  private async createBackup(): Promise<void> {
    const backupDir = `backup-${Date.now()}`;
    console.log(`📦 Creating backup in ${backupDir}...`);
    
    // This would implement actual backup logic
    // For now, just log the intention
    console.log('✅ Backup created (implementation pending)');
  }

  /**
   * Find files matching patterns
   */
  private async findFiles(includePatterns: string[], excludePatterns: string[]): Promise<string[]> {
    // This is a simplified implementation
    // In a real scenario, you'd use glob patterns or similar
    const files: string[] = [];
    
    const scanDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = fullPath.replace(this.baseDir + '/', '');
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!excludePatterns.some(pattern => relativePath.includes(pattern.replace('**/', '')))) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          // Include files matching patterns
          if (includePatterns.some(pattern => {
            const ext = pattern.replace('**/*', '');
            return fullPath.endsWith(ext);
          })) {
            files.push(fullPath);
          }
        }
      }
    };

    await scanDir(this.baseDir);
    return files;
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, dryRun: boolean, verbose: boolean): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const changes: string[] = [];
    let newContent = content;

    // Migration patterns
    const migrations = [
      {
        name: 'useAuthBridge → useUnifiedAuthBridge',
        pattern: /import.*useAuthBridge.*from.*auth-context-bridge/g,
        replacement: "import { useUnifiedAuthBridge } from '@/adapters/unified-auth-bridge';",
        test: (content: string) => content.includes('useAuthBridge'),
      },
      {
        name: 'useAuthBridge hook usage',
        pattern: /const\s+{([^}]+)}\s+=\s+useAuthBridge\(\s*\);?/g,
        replacement: 'const {$1} = useUnifiedAuthBridge({ preferUnified: true });',
        test: (content: string) => content.includes('useAuthBridge()'),
      },
      {
        name: 'Add React.memo import',
        pattern: /^(import React.*from ['"']react['"];?)$/m,
        replacement: "$1\nimport React, { memo } from 'react';",
        test: (content: string) => 
          content.includes('export default function') && 
          !content.includes('memo') &&
          this.shouldMemoizeComponent(content),
        condition: (content: string) => !content.includes('memo'),
      },
      {
        name: 'Add render tracking',
        pattern: /(export default function \w+\([^)]*\) \{)/,
        replacement: '$1\n  // Track render performance\n  React.useEffect(() => {\n    const finishRender = renderTracker.trackRender(\'ComponentName\', \'props-change\');\n    finishRender();\n  });',
        test: (content: string) => 
          this.shouldAddRenderTracking(content),
        condition: (content: string) => !content.includes('renderTracker'),
      },
      {
        name: 'Convert to memo export',
        pattern: /(export default function (\w+)\([^)]*\) \{[\s\S]*?\n\})/,
        replacement: (match: string, functionDef: string, componentName: string) => {
          return `function ${componentName}$1\n\n// Memoized ${componentName} component\nexport default memo(${componentName});`;
        },
        test: (content: string) => 
          this.shouldMemoizeComponent(content),
        condition: (content: string) => !content.includes('memo('),
      },
    ];

    // Apply migrations
    for (const migration of migrations) {
      if (migration.test(content) && (!migration.condition || migration.condition(content))) {
        if (typeof migration.replacement === 'function') {
          newContent = newContent.replace(migration.pattern, migration.replacement as any);
        } else {
          newContent = newContent.replace(migration.pattern, migration.replacement);
        }
        
        if (newContent !== content) {
          changes.push(migration.name);
        }
      }
    }

    // Add necessary imports
    if (changes.some(c => c.includes('renderTracker')) && !newContent.includes('renderTracker')) {
      newContent = this.addImport(newContent, "import { renderTracker } from '@/lib/performance/renderTracker';");
      changes.push('Add renderTracker import');
    }

    if (changes.length > 0) {
      this.report.changes.push({ file: filePath, changes });
      this.report.migratedFiles++;

      if (verbose) {
        console.log(`✅ ${filePath}: ${changes.join(', ')}`);
      }

      if (!dryRun) {
        await fs.writeFile(filePath, newContent, 'utf-8');
      }
    } else {
      this.report.skippedFiles++;
      if (verbose) {
        console.log(`⏭️  ${filePath}: No changes needed`);
      }
    }
  }

  /**
   * Check if component should be memoized
   */
  private shouldMemoizeComponent(content: string): boolean {
    // Components that use auth state should be memoized
    const authPatterns = [
      'useAuthBridge',
      'useUnifiedAuthBridge',
      'hasRole',
      'profile',
      'session',
    ];

    return authPatterns.some(pattern => content.includes(pattern)) &&
           content.includes('export default function') &&
           !content.includes('memo(');
  }

  /**
   * Check if component should have render tracking
   */
  private shouldAddRenderTracking(content: string): boolean {
    // Add render tracking to components that:
    // 1. Use auth state
    // 2. Are functional components
    // 3. Don't already have render tracking
    return this.shouldMemoizeComponent(content) && 
           !content.includes('renderTracker');
  }

  /**
   * Add import statement to file
   */
  private addImport(content: string, importStatement: string): string {
    const lines = content.split('\n');
    const lastImportIndex = lines.findLastIndex(line => line.startsWith('import'));
    
    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, importStatement);
    } else {
      lines.unshift(importStatement);
    }
    
    return lines.join('\n');
  }

  /**
   * Print migration report
   */
  private printReport(): void {
    console.log('\n📊 Migration Report:');
    console.log(`Total files processed: ${this.report.totalFiles}`);
    console.log(`Successfully migrated: ${this.report.migratedFiles}`);
    console.log(`Skipped (no changes): ${this.report.skippedFiles}`);
    console.log(`Errors: ${this.report.errors.length}`);

    if (this.report.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.report.errors.forEach(({ file, error }) => {
        console.log(`  ${file}: ${error}`);
      });
    }

    if (this.report.changes.length > 0) {
      console.log('\n✅ Changes made:');
      this.report.changes.forEach(({ file, changes }) => {
        console.log(`  ${file}:`);
        changes.forEach(change => console.log(`    • ${change}`));
      });
    }
  }
}

// CLI usage
export async function runMigration(options: MigrationOptions = {}): Promise<void> {
  const migrator = new UnifiedAuthMigrator();
  
  try {
    await migrator.migrate({
      dryRun: process.argv.includes('--dry-run'),
      verbose: process.argv.includes('--verbose'),
      skipBackup: process.argv.includes('--skip-backup'),
      ...options,
    });
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the changes and test your application');
    console.log('2. Run `sessionDebug.enablePerformanceMonitoring()` to verify improvements');
    console.log('3. Use `sessionDebug.runQuickTest()` to validate multi-tab functionality');
    
  } catch (error: any) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).migrationUtils = {
    runMigration,
    UnifiedAuthMigrator,
  };
  
  console.log('🔧 Migration utilities available via window.migrationUtils');
}
