import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import CharacterStudioModal from './CharacterStudioModal';
import api from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../services/api', () => ({
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  post: jest.fn()
}));

const mockLang = { t: (key) => key };
jest.mock('../i18n', () => ({
  useLang: () => mockLang
}));

const mockPush = jest.fn();
const mockConfirm = jest.fn();
const mockToastCtx = { push: mockPush };
const mockConfirmCtx = { confirm: mockConfirm };

jest.mock('./Toast', () => ({
  useToast: () => mockToastCtx,
  useConfirm: () => mockConfirmCtx
}));

const setNativeValue = (element, value) => {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('CharacterStudioModal Component', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
    jest.clearAllMocks();

    api.get.mockResolvedValue({
      data: {
        success: true,
        characterId: 'lyra',
        customConfig: {}
      }
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  const renderModal = async (props = {}) => {
    await act(async () => {
      root.render(
        <CharacterStudioModal
          open={true}
          onClose={jest.fn()}
          friend={{ _id: 'user_ai_lyra', name: 'Lyra' }}
          friendId="user_ai_lyra"
          {...props}
        />
      );
    });
    // Flush microtasks for useEffect async load
    await act(async () => {
      await Promise.resolve();
    });
  };

  test('does not render when open=false', async () => {
    await act(async () => {
      root.render(
        <CharacterStudioModal
          open={false}
          onClose={jest.fn()}
          friend={{ _id: 'user_ai_lyra', name: 'Lyra' }}
          friendId="user_ai_lyra"
        />
      );
    });

    expect(container.innerHTML).toBe('');
  });

  test('loads and displays character config with 8 tabs when open=true', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'My custom Lyra description',
          personality: 'Warm and empathetic',
          personalityTags: ['Caring', 'Playful'],
          speakingStyle: 'Gentle and cozy',
          wordsUsed: 'darling, sweetheart',
          wordsAvoided: 'bro, dude',
          thoughtProcess: 'Values honest moments',
          relationship: 'Close confidante',
          lore: 'Met under the cherry blossoms',
          examples: [
            { user: 'Good morning!', lyra: 'Good morning, sunshine! Ready for today?' }
          ]
        }
      }
    });

    await renderModal();

    expect(api.get).toHaveBeenCalledWith('/ai/character/config');

    // Check header title and subtitle
    expect(container.textContent).toContain('characterStudioTitle');
    expect(container.textContent).toContain('characterStudioSubtitle');

    // Check all 8 tabs are rendered
    expect(container.textContent).toContain('tabIdentity');
    expect(container.textContent).toContain('tabPersonality');
    expect(container.textContent).toContain('tabSpeech');
    expect(container.textContent).toContain('tabMind');
    expect(container.textContent).toContain('tabRelationship');
    expect(container.textContent).toContain('tabLore');
    expect(container.textContent).toContain('tabExamples');
    expect(container.textContent).toContain('tabPreview');

    // In the identity tab, the about input should have the loaded value
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('My custom Lyra description');
  });

  test('switches tabs smoothly when clicking tab buttons', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'Initial about',
          speakingStyle: 'Loves using exclamation marks'
        }
      }
    });

    await renderModal();

    // Click speech tab button
    const speechTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('tabSpeech')
    );
    expect(speechTabBtn).toBeDefined();

    await act(async () => {
      speechTabBtn.click();
    });

    // Now speech tab fields should be visible
    expect(container.textContent).toContain('Texting & Speaking Style');
    expect(container.textContent).toContain('Favorite Words / Phrases');
    expect(container.textContent).toContain('Words / Phrases to Avoid');
  });

  test('saves customized configuration on save click', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'Original about'
        }
      }
    });
    api.put.mockResolvedValueOnce({
      data: { success: true, customConfig: { about: 'Updated about text' } }
    });

    const onSavedMock = jest.fn();
    await renderModal({ onSaved: onSavedMock });

    // Edit the about textarea using synthetic input setter
    const textarea = container.querySelector('textarea');
    await act(async () => {
      setNativeValue(textarea, 'Updated about text');
    });

    // Click save button
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('saveCustomization')
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn.click();
      await Promise.resolve();
    });

    expect(api.put).toHaveBeenCalledWith(
      '/ai/character/config',
      expect.objectContaining({
        customConfig: expect.objectContaining({
          about: 'Updated about text'
        })
      })
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success' })
    );
    expect(onSavedMock).toHaveBeenCalled();
  });

  test('resets configuration when confirmed by user', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'Custom about that will be cleared'
        }
      }
    });
    api.delete.mockResolvedValueOnce({
      data: { success: true }
    });
    mockConfirm.mockResolvedValueOnce(true);

    const onSavedMock = jest.fn();
    await renderModal({ onSaved: onSavedMock });

    // Click reset button
    const resetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('resetCustomization')
    );
    expect(resetBtn).toBeDefined();

    await act(async () => {
      resetBtn.click();
      await Promise.resolve();
    });

    expect(mockConfirm).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith('/ai/character/config');
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success' })
    );
    expect(onSavedMock).toHaveBeenCalled();
  });

  test('isolated preview tab allows sending test messages without modifying chat state', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'Playful companion'
        }
      }
    });
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        bubbles: ['Hey there! This is test Lyra speaking. ✨']
      }
    });

    await renderModal();

    // Click preview tab
    const previewTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('tabPreview')
    );
    expect(previewTabBtn).toBeDefined();

    await act(async () => {
      previewTabBtn.click();
    });

    expect(container.textContent).toContain('Live Test Conversation');

    // Type a message in the preview input
    const inputs = container.querySelectorAll('input');
    const previewInput = Array.from(inputs).find((i) => i.placeholder === 'previewInputPlaceholder' || i.type === 'text');
    expect(previewInput).toBeDefined();

    await act(async () => {
      setNativeValue(previewInput, 'Hello from preview!');
    });

    // Submit form
    const previewForm = previewInput.closest('form');
    expect(previewForm).toBeDefined();

    await act(async () => {
      previewForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(api.post).toHaveBeenCalledWith(
      '/ai/character/preview',
      expect.objectContaining({
        userMessage: 'Hello from preview!',
        customConfig: expect.any(Object)
      })
    );

    // Verify response bubble is displayed
    expect(container.textContent).toContain('Hey there! This is test Lyra speaking. ✨');
  });
});
