import versionMeta from './version.json';
import { BUILD_ID } from './buildMeta.generated';

export const CURRENT_APP_VERSION = versionMeta.version;
export const RUNNING_BUILD_ID = BUILD_ID;

export const compareVersions = (a, b) => {
  const left = String(a || '').split('.').map(Number);
  const right = String(b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) - (right[i] || 0);
  }
  return 0;
};
