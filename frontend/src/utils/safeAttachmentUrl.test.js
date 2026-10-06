import { safeAttachmentDataUrl } from './safeAttachmentUrl';

test('allows supported canonical inline attachment through the render boundary', () => {
  expect(safeAttachmentDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  expect(safeAttachmentDataUrl('data:application/pdf;base64,JVBERi0=')).toBe('data:application/pdf;base64,JVBERi0=');
});

test('blocks active, internal, external, malformed, and encoded attachment URLs', () => {
  [
    'javascript:alert(1)', 'file:///etc/passwd', 'capacitor://localhost/path',
    'https://attacker.example/payload', 'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,%%%=',
    'data:image/png;base64%2ciVBORw0KGgo=', 'data:image/png;base64,iVBORw0KGg'
  ].forEach(value => expect(safeAttachmentDataUrl(value)).toBeNull());
});
