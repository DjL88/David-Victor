import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Section 52: CI / Static Test Regression Protection
 * 
 * Verifies that:
 * 1. Customer-facing components, features, and hooks NEVER import mock data fixtures or mock clients directly.
 * 2. Production HTTP clients and adapters never leak mock imports outside of explicitly whitelisted demo modules.
 * 3. Bwydi branding / fonts are strictly scoped and never leaked into customer index.css or customer entry points.
 */

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // Skip node_modules, dist, .git, and tests
      if (!['node_modules', 'dist', '.git', '__tests__'].includes(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe('Section 52: Static Architecture & Mock Leak Prevention', () => {
  const projectRoot = path.resolve(__dirname, '../..');

  it('prohibits customer storefront components from importing mockData fixtures', () => {
    const customerDirs = [
      path.join(projectRoot, 'src', 'features'),
      path.join(projectRoot, 'src', 'components'),
      path.join(projectRoot, 'src', 'hooks'),
    ];

    const customerFiles: string[] = [];
    customerDirs.forEach((dir) => {
      getAllFiles(dir, customerFiles);
    });

    const violations: { file: string; line: string }[] = [];

    customerFiles.forEach((filePath) => {
      const relPath = path.relative(projectRoot, filePath);
      // Whitelist only explicit DemoBanner
      if (relPath === path.join('src', 'components', 'DemoBanner.tsx')) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line) => {
        // Look for imports from mockData
        if (
          /import\s+.*from\s+['"].*\/commerce\/mockData['"]/.test(line) ||
          /import\s+.*MOCK_(PRODUCTS|CATEGORIES|STORES|DEALS|SAVED_ADDRESSES)/.test(line)
        ) {
          violations.push({
            file: relPath,
            line: line.trim(),
          });
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('prohibits customer storefront components from importing MockAnalyticsClient directly', () => {
    const srcDir = path.join(projectRoot, 'src');
    const allSrcFiles = getAllFiles(srcDir);

    const violations: { file: string; line: string }[] = [];

    allSrcFiles.forEach((filePath) => {
      const relPath = path.relative(projectRoot, filePath);
      
      // Whitelisted files allowed to touch MockAnalyticsClient:
      // - src/analytics/index.ts (the provider boundary)
      // - src/analytics/MockAnalyticsClient.ts (the implementation)
      if (
        relPath === path.join('src', 'analytics', 'index.ts') ||
        relPath === path.join('src', 'analytics', 'MockAnalyticsClient.ts')
      ) {
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line) => {
        if (/import\s+.*from\s+['"].*\/MockAnalyticsClient['"]/.test(line)) {
          violations.push({
            file: relPath,
            line: line.trim(),
          });
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('prohibits production Deliverect adapters from importing mock fixtures or demo adapters', () => {
    const prodAdapters = [
      path.join(projectRoot, 'server', 'deliverect', 'DeliverectApiClient.ts'),
      path.join(projectRoot, 'server', 'deliverect', 'DeliverectDispatchAdapter.ts'),
      path.join(projectRoot, 'server', 'deliverect', 'DeliverectDPayAdapter.ts'),
      path.join(projectRoot, 'server', 'deliverect', 'OAuthTokenManager.ts'),
      path.join(projectRoot, 'server', 'deliverect', 'WebhookService.ts'),
    ];

    const violations: { file: string; line: string }[] = [];

    prodAdapters.forEach((filePath) => {
      if (!fs.existsSync(filePath)) return;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line) => {
        if (
          /import\s+.*from\s+['"].*(Mock|Demo|mockData).*['"]/.test(line) &&
          !line.includes('// Whitelisted')
        ) {
          violations.push({
            file: path.relative(projectRoot, filePath),
            line: line.trim(),
          });
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('confirms Croogla font definition is removed from global src/index.css', () => {
    const indexCssPath = path.join(projectRoot, 'src', 'index.css');
    const content = fs.readFileSync(indexCssPath, 'utf-8');

    expect(content).not.toContain('@font-face');
    expect(content).not.toContain('Croogla');
    expect(content).not.toContain('.font-croogla');
  });

  it('confirms index.html does not contain hardcoded Bwydi metadata or static fonts', () => {
    const indexHtmlPath = path.join(projectRoot, 'index.html');
    const content = fs.readFileSync(indexHtmlPath, 'utf-8');

    expect(content).not.toContain('Croogla');
    expect(content).not.toContain('Bwydi');
    expect(content).not.toContain('bwydi');
  });
});
