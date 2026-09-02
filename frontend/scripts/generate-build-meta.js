const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'src/version.json'), 'utf8')).version;
let source = process.env.REACT_APP_BUILD_ID || process.env.RENDER_GIT_COMMIT || '';

if (!source) {
  try {
    source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    source = `local-${Date.now()}`;
  }
}

const buildId = crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
const output = `// Generated at build time. Do not edit.\nexport const APP_VERSION = ${JSON.stringify(version)};\nexport const BUILD_ID = ${JSON.stringify(buildId)};\n`;
fs.writeFileSync(path.join(root, 'src/buildMeta.generated.js'), output);
