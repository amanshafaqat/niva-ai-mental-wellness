/**
 * NIVA Phase 2 Project Packager
 * Generates clean, production-ready niva-phase-2.zip archive
 * Excludes: node_modules, build artifacts, git internals, and secrets.
 */

import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.cache',
  'coverage',
  '.turbo',
]);

const EXCLUDED_FILES = new Set([
  '.env',
  '.env.local',
  '.DS_Store',
  'niva-phase-1.zip',
  'niva-phase-2.zip',
]);

function shouldInclude(filePath: string, relativePath: string): boolean {
  const parts = relativePath.split(path.sep);
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return false;
  }
  const fileName = path.basename(filePath);
  if (EXCLUDED_FILES.has(fileName)) return false;
  if (fileName.endsWith('.zip')) return false;
  return true;
}

function addDirectoryToZip(zip: JSZip, rootDir: string, currentDir: string) {
  const files = fs.readdirSync(currentDir);

  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const relPath = path.relative(rootDir, fullPath);

    if (!shouldInclude(fullPath, relPath)) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      addDirectoryToZip(zip, rootDir, fullPath);
    } else {
      const content = fs.readFileSync(fullPath);
      zip.file(relPath, content);
    }
  }
}

export async function generateProjectZipBuffer(rootDir = process.cwd()): Promise<Buffer> {
  const zip = new JSZip();
  addDirectoryToZip(zip, rootDir, rootDir);
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

async function main() {
  console.log('📦 Packaging NIVA Phase 2 Monorepo...');
  const buffer = await generateProjectZipBuffer(process.cwd());
  const outputPath = path.join(process.cwd(), 'niva-phase-2.zip');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Package generated successfully at: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && process.argv[1].endsWith('package-project.ts')) {
  main().catch(console.error);
}
