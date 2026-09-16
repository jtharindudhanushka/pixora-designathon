const fs = require('fs');
const path = require('path');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Create dist/server.js proxy entrypoint
const entryContent = "import './src/server.js';\n";
fs.writeFileSync(path.join('dist', 'server.js'), entryContent, 'utf8');
console.log('✔ Generated dist/server.js entrypoint');

// Ensure public files exist inside dist/public and dist/src/public for static asset fallbacks
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir('public', path.join('dist', 'public'));
copyDir('public', path.join('dist', 'src', 'public'));
console.log('✔ Synced static assets into dist');
