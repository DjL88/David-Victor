/**
 * Phase 1: Environment Initialization & Data Purge Script
 * Traverses data/tenants.json, data/domains.json, and data/integrations.json.
 * Purges keys matching /^brand-(test|audit)-/ and retains canonical core brands:
 * ['brand-alpha', 'brand-beta', 'onestop-express', 'greengrocer-co', 'urban-pantry', 'bwydi-deliverect-test']
 */

import fs from 'fs';
import path from 'path';

const RETAINED_CORE_BRANDS = new Set([
  'brand-alpha',
  'brand-beta',
  'onestop-express',
  'greengrocer-co',
  'urban-pantry',
  'bwydi-deliverect-test',
]);

const TEST_AUDIT_REGEX = /^brand-(test|audit)-/;

function purgeFile(relativeFilePath, isIntegration = false) {
  const filePath = path.resolve(process.cwd(), relativeFilePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON in ${filePath}:`, err);
    return;
  }

  const keysBefore = Object.keys(data).length;
  for (const key of Object.keys(data)) {
    if (isIntegration) {
      const item = data[key];
      const tenantId = (item && item.tenantId) || key;
      if (TEST_AUDIT_REGEX.test(key) || TEST_AUDIT_REGEX.test(tenantId)) {
        delete data[key];
      } else if (!RETAINED_CORE_BRANDS.has(tenantId) && !RETAINED_CORE_BRANDS.has(key)) {
        // Strip out any non-core synthetic integrations
        delete data[key];
      }
    } else {
      if (TEST_AUDIT_REGEX.test(key) && !RETAINED_CORE_BRANDS.has(key)) {
        delete data[key];
      }
    }
  }

  const keysAfter = Object.keys(data).length;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[Purge] ${relativeFilePath}: ${keysBefore} -> ${keysAfter} entries retained.`);
}

console.log('--- Starting Phase 1 Environment Initialization & Data Purge ---');
purgeFile('data/tenants.json', false);
purgeFile('data/domains.json', false);
purgeFile('data/integrations.json', true);
console.log('--- Phase 1 Purge Complete ---');
