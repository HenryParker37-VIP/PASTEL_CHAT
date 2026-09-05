const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.join(__dirname, '..', '..');
let appVersion = '1.1.0';
try {
  const versionPath = path.join(projectRoot, 'frontend', 'src', 'version.json');
  if (fs.existsSync(versionPath)) {
    appVersion = JSON.parse(fs.readFileSync(versionPath, 'utf8')).version;
  }
} catch {}

function sourceRevision() {
  if (process.env.REACT_APP_BUILD_ID) return process.env.REACT_APP_BUILD_ID;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  try {
    const metaPath = path.join(projectRoot, 'frontend', 'src', 'buildMeta.generated.js');
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf8');
      const match = content.match(/BUILD_ID = "([^"]+)"/);
      if (match) return match[1];
    }
  } catch {}
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'release-v1';
  }
}

function computeBuildId() {
  try {
    const metaPath = path.join(projectRoot, 'frontend', 'src', 'buildMeta.generated.js');
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf8');
      const match = content.match(/BUILD_ID = "([^"]+)"/);
      if (match) return match[1];
    }
  } catch {}
  return crypto.createHash('sha256').update(sourceRevision()).digest('hex').slice(0, 12);
}

const buildId = computeBuildId();

module.exports = {
  appVersion,
  buildId,
  deployedAt: process.env.VERCEL_DEPLOYMENT_ID || new Date().toISOString()
};
