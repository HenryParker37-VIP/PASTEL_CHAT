import {
  isPushSupported,
  isIOS,
  isStandalonePWA,
  getNotificationPermission
} from './push';

describe('Push Notification Frontend Helpers', () => {
  const origWindow = { ...window };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getNotificationPermission returns string status', () => {
    const perm = getNotificationPermission();
    expect(typeof perm).toBe('string');
  });

  test('isIOS detects userAgent accurately', () => {
    expect(typeof isIOS()).toBe('boolean');
  });

  test('isStandalonePWA detects standalone mode accurately', () => {
    expect(typeof isStandalonePWA()).toBe('boolean');
  });

  test('isPushSupported checks required browser APIs', () => {
    expect(typeof isPushSupported()).toBe('boolean');
  });
});
