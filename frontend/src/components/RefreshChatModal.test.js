import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import RefreshChatModal from './RefreshChatModal';
import en from '../i18n/en';
import vi from '../i18n/vi';

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockCurrentLang = 'en';
jest.mock('../i18n', () => ({
  useLang: () => ({
    t: (key) => (mockCurrentLang === 'vi' ? require('../i18n/vi').default[key] || key : require('../i18n/en').default[key] || key),
    lang: mockCurrentLang
  })
}));

describe('RefreshChatModal Component', () => {
  let container;
  let root;

  beforeEach(() => {
    mockCurrentLang = 'en';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test('does not render when open is false', () => {
    act(() => {
      root.render(<RefreshChatModal open={false} />);
    });
    expect(container.querySelector('.refresh-chat-modal')).toBeNull();
  });

  test('renders exact English title, message, and 3 buttons when open is true', () => {
    mockCurrentLang = 'en';
    act(() => {
      root.render(<RefreshChatModal open={true} onClose={jest.fn()} onClear={jest.fn()} onKeep={jest.fn()} />);
    });

    const modal = container.querySelector('.refresh-chat-modal');
    expect(modal).not.toBeNull();

    // Verify Title
    const title = modal.querySelector('#refresh-chat-title');
    expect(title.textContent).toBe('Refresh Chat');

    // Verify Message
    const message = modal.querySelector('#refresh-chat-message');
    expect(message.textContent).toBe('Wanna clear this chat and start a new one, or keep this current chat?');

    // Verify 3 Buttons
    const buttons = modal.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toContain('Clear & Start New');
    expect(buttons[1].textContent).toContain('Keep & Start New');
    expect(buttons[2].textContent).toContain('Cancel');
  });

  test('renders exact Vietnamese title, message, and 3 buttons when language switches to Vietnamese', () => {
    mockCurrentLang = 'vi';
    act(() => {
      root.render(<RefreshChatModal open={true} onClose={jest.fn()} onClear={jest.fn()} onKeep={jest.fn()} />);
    });

    const modal = container.querySelector('.refresh-chat-modal');
    expect(modal).not.toBeNull();

    // Verify Title
    const title = modal.querySelector('#refresh-chat-title');
    expect(title.textContent).toBe('Làm mới cuộc trò chuyện');

    // Verify Message
    const message = modal.querySelector('#refresh-chat-message');
    expect(message.textContent).toBe('Bạn muốn xoá cuộc trò chuyện này và bắt đầu cuộc trò chuyện mới, hay giữ lại cuộc trò chuyện hiện tại?');

    // Verify 3 Buttons
    const buttons = modal.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toContain('Xoá & Bắt đầu mới');
    expect(buttons[1].textContent).toContain('Giữ lại & Bắt đầu mới');
    expect(buttons[2].textContent).toContain('Huỷ');
  });

  test('clicking Clear & Start New invokes onClear', () => {
    const onClear = jest.fn();
    act(() => {
      root.render(<RefreshChatModal open={true} onClose={jest.fn()} onClear={onClear} onKeep={jest.fn()} />);
    });

    const buttons = container.querySelectorAll('.refresh-chat-modal button');
    act(() => {
      buttons[0].click();
    });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('clicking Keep & Start New invokes onKeep', () => {
    const onKeep = jest.fn();
    act(() => {
      root.render(<RefreshChatModal open={true} onClose={jest.fn()} onClear={jest.fn()} onKeep={onKeep} />);
    });

    const buttons = container.querySelectorAll('.refresh-chat-modal button');
    act(() => {
      buttons[1].click();
    });
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  test('clicking Cancel invokes onClose', () => {
    const onClose = jest.fn();
    act(() => {
      root.render(<RefreshChatModal open={true} onClose={onClose} onClear={jest.fn()} onKeep={jest.fn()} />);
    });

    const buttons = container.querySelectorAll('.refresh-chat-modal button');
    act(() => {
      buttons[2].click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('pressing Escape invokes onClose', () => {
    const onClose = jest.fn();
    act(() => {
      root.render(<RefreshChatModal open={true} onClose={onClose} onClear={jest.fn()} onKeep={jest.fn()} />);
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking backdrop invokes onClose', () => {
    const onClose = jest.fn();
    act(() => {
      root.render(<RefreshChatModal open={true} onClose={onClose} onClear={jest.fn()} onKeep={jest.fn()} />);
    });

    const backdrop = container.querySelector('.feedback-backdrop');
    act(() => {
      backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
