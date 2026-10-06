import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MessageItem from './MessageItem';

jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'qa-user-a' } }) }));
jest.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ lyraAvatar: null }) }));
jest.mock('./Toast', () => ({ useToast: () => ({ push: jest.fn() }), useConfirm: () => ({ confirm: jest.fn() }) }));
jest.mock('../i18n', () => ({ useLang: () => ({ t: key => key }) }));
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('./GifMessage', () => () => null);
jest.mock('./StickerDisplay', () => () => null);
jest.mock('./PastelIcon', () => () => null);
jest.mock('../utils/pastelIdentity', () => ({ getPastelColor: () => '#ffffff', getPastelIdentity: () => '#ffffff' }));
jest.mock('../utils/characterAvatar', () => ({ resolveCharacterAvatar: () => '' }));

const renderMedia = dataUrl => renderToStaticMarkup(
  <MessageItem
    message={{ _id: 'qa-message', senderId: 'qa-user-a', content: '', timestamp: new Date().toISOString(), media: { type: 'file', name: 'qa.bin', size: 8, dataUrl } }}
    peer={{ _id: 'qa-user-b', name: 'QA B' }}
  />
);

test('MessageItem only emits attachment navigation for allowlisted data URLs', () => {
  expect(renderMedia('data:application/pdf;base64,JVBERi0=')).toContain('href="data:application/pdf;base64,JVBERi0="');
  for (const value of ['javascript:alert(1)', 'file:///etc/passwd', 'capacitor://localhost/internal', 'https://attacker.example/x', 'data:text/html;base64,PHNjcmlwdD4=']) {
    const markup = renderMedia(value);
    expect(markup).not.toContain('href=');
    expect(markup).not.toContain('src=');
  }
});
