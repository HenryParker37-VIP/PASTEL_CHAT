const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const projectRoot = path.join(__dirname, '..', '..');
const versionPath = path.join(projectRoot, 'frontend', 'src', 'version.json');
const appVersion = JSON.parse(fs.readFileSync(versionPath, 'utf8')).version;
const startedAt = new Date().toISOString();

function sourceRevision() {
  if (process.env.REACT_APP_BUILD_ID) return process.env.REACT_APP_BUILD_ID;
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
}

const buildId = crypto.createHash('sha256').update(sourceRevision()).digest('hex').slice(0, 12);

module.exports = {
  appVersion,
  buildId,
  deployedAt: process.env.RENDER_DEPLOYED_AT || startedAt
};
