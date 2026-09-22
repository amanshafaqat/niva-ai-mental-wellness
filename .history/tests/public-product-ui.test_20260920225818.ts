import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8');
const navSource = readFileSync(join(root, 'src/components/Navbar.tsx'), 'utf8');
const heroSource = readFileSync(join(root, 'src/components/HeroSection.tsx'), 'utf8');

assert.doesNotMatch(appSource, /Architecture & Specs|System Health|Download Phase 5 ZIP|Phase 5 Advanced Safety & Crisis Engine/i);
assert.doesNotMatch(navSource, /Architecture & Specs|System Health|Phase 5 ZIP/i);
assert.doesNotMatch(heroSource, /Explore Phase 4\.1 Architecture|Phase 2: Authentication, User Identity & RBAC/i);
assert.match(appSource, /Founded & Created by Aman Shafaqat/i);

console.log('public product UI regression checks passed');
