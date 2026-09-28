#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const run = (cmd, label) => {
  console.log(`\n> ${label ?? cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

console.log('career-ops setup\n================');

// ── Node version ──────────────────────────────────────────────────────────────
const major = parseInt(process.version.slice(1));
if (major < 18) {
  console.error(`ERROR: Node.js v18+ required. Found: ${process.version}`);
  process.exit(1);
}
console.log(`Node.js ${process.version} OK`);

// ── npm deps ──────────────────────────────────────────────────────────────────
run('npm install', 'Installing npm dependencies...');

// ── Playwright chromium ───────────────────────────────────────────────────────
run('npx playwright install chromium', 'Installing Playwright chromium...');

// ── Claude Code ───────────────────────────────────────────────────────────────
try {
  execSync('claude --version', { stdio: 'pipe' });
  console.log('\nClaude Code already installed');
} catch {
  run('npm install -g @anthropic-ai/claude-code', 'Installing Claude Code...');
}

// ── Caveman plugin ────────────────────────────────────────────────────────────
if (process.env.SKIP_CAVEMAN !== '1') {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  mkdirSync(join(homedir(), '.claude'), { recursive: true });

  let settings = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {}
  }

  const alreadyRegistered = settings?.extraKnownMarketplaces?.caveman;
  if (!alreadyRegistered) {
    console.log('\nRegistering caveman plugin...');
    settings.extraKnownMarketplaces = settings.extraKnownMarketplaces || {};
    settings.extraKnownMarketplaces.caveman = {
      source: { repo: 'JuliusBrussee/caveman', source: 'github' }
    };
    settings.enabledPlugins = settings.enabledPlugins || {};
    settings.enabledPlugins['caveman@caveman'] = true;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
    console.log('Caveman registered. Restart Claude Code to activate.');
  } else {
    console.log('\nCaveman already registered');
  }
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log(`
Setup complete. Start with:
  claude

First run guides you through onboarding (CV, profile, portals).
To reset for a new user: tell Claude "reset"
`);
