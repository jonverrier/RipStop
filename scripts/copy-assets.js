// Copyright (c) 2026 Jon Verrier

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'src', 'presets');
const targetDir = path.join(__dirname, '..', 'dist', 'src', 'presets');

if (!fs.existsSync(sourceDir)) {
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

for (const entry of fs.readdirSync(sourceDir)) {
  if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
    fs.copyFileSync(path.join(sourceDir, entry), path.join(targetDir, entry));
  }
}
