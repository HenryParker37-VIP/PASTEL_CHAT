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
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  if (process.env.REACT_APP_BUILD_ID) return process.env.REACT_APP_BUILD_ID;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch {}
  try {
    const metaPath = path.join(projectRoot, 'frontend', 'src', 'buildMeta.generated.js');
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf8');
      const commitMatch = content.match(/COMMIT_SHA = "([^"]+)"/);
      if (commitMatch) return commitMatch[1];
      const match = content.match(/BUILD_ID = "([^"]+)"/);
      if (match) return match[1];
    }
  } catch {}
  return 'release-v1';
}

function computeBuildId() {
  const rev = sourceRevision();
  if (/^[0-9a-f]{7,40}$/i.test(rev)) {
    return rev.slice(0, 12).toLowerCase();
  }
  try {
    const metaPath = path.join(projectRoot, 'frontend', 'src', 'buildMeta.generated.js');
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf8');
      const match = content.match(/BUILD_ID = "([^"]+)"/);
      if (match) return match[1];
    }
  } catch {}
  return crypto.createHash('sha256').update(rev).digest('hex').slice(0, 12);
}

const buildId = computeBuildId();
const commit = sourceRevision();

module.exports = {
  appVersion,
  buildId,
  commit,
  deployedAt: process.env.VERCEL_DEPLOYMENT_ID || new Date().toISOString()
};
