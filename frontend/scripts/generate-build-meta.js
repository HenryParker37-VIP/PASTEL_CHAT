const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'src/version.json'), 'utf8')).version;
let source = process.env.VERCEL_GIT_COMMIT_SHA || process.env.REACT_APP_BUILD_ID || process.env.RENDER_GIT_COMMIT || '';

if (!source) {
  try {
    source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    source = `local-${Date.now()}`;
  }
}

const buildId = /^[0-9a-f]{7,40}$/i.test(source) ? source.slice(0, 12).toLowerCase() : crypto.createHash('sha256').update(source).digest('hex').slice(0, 12);
const output = `// Generated at build time. Do not edit.\nexport const APP_VERSION = ${JSON.stringify(version)};\nexport const BUILD_ID = ${JSON.stringify(buildId)};\nexport const COMMIT_SHA = ${JSON.stringify(source)};\n`;
fs.writeFileSync(path.join(root, 'src/buildMeta.generated.js'), output);
