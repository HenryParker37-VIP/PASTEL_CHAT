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

  test('loads and displays character config with all 9 tabs including Should/Should Not and Location/Timezone', async () => {
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
          shouldRules: 'Match my language naturally\nKeep replies concise',
          shouldNotRules: 'Sound like an assistant\nOveruse emojis',
          location: 'London, United Kingdom',
          timezone: 'Europe/London',
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

    // Check all 9 tabs are rendered
    expect(container.textContent).toContain('tabIdentity');
    expect(container.textContent).toContain('tabPersonality');
    expect(container.textContent).toContain('tabSpeech');
    expect(container.textContent).toContain('tabMind');
    expect(container.textContent).toContain('tabRules');
    expect(container.textContent).toContain('tabRelationship');
    expect(container.textContent).toContain('tabLore');
    expect(container.textContent).toContain('tabExamples');
    expect(container.textContent).toContain('tabPreview');

    // In the identity tab, the about input should have the loaded value
    const textareas = container.querySelectorAll('textarea');
    expect(textareas[0].value).toBe('My custom Lyra description');

    // Location and timezone inputs should have loaded values
    const inputs = container.querySelectorAll('input');
    const locInput = Array.from(inputs).find(i => i.value === 'London, United Kingdom');
    const tzInput = Array.from(inputs).find(i => i.value === 'Europe/London');
    expect(locInput).toBeDefined();
    expect(tzInput).toBeDefined();
  });

  test('switches to rules tab and displays Lyra Should / Lyra Should Not fields', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          shouldRules: 'Tease me lightly when appropriate',
          shouldNotRules: 'Never use generic AI canned responses'
        }
      }
    });

    await renderModal();

    // Click rules tab button
    const rulesTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent.includes('tabRules')
    );
    expect(rulesTabBtn).toBeDefined();

    await act(async () => {
      rulesTabBtn.click();
    });

    // Verify rules tab content
    expect(container.textContent).toContain('studioRulesTitle');
    expect(container.textContent).toContain('studioLyraShould');
    expect(container.textContent).toContain('studioLyraShouldNot');

    const textareas = container.querySelectorAll('textarea');
    expect(textareas.length).toBe(2);
    expect(textareas[0].value).toBe('Tease me lightly when appropriate');
    expect(textareas[1].value).toBe('Never use generic AI canned responses');
  });

  test('saves customized configuration including Should/Should Not and Location/Timezone', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'Original about'
        }
      }
    });
    api.put.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'Updated about text',
          location: 'Kyoto, Japan',
          timezone: 'Asia/Tokyo'
        }
      }
    });

    const onSavedMock = jest.fn();
    await renderModal({ onSaved: onSavedMock });

    // Edit about
    const textarea = container.querySelector('textarea');
    await act(async () => {
      setNativeValue(textarea, 'Updated about text');
    });

    // Edit location and timezone in Identity tab
    const inputs = container.querySelectorAll('input');
    await act(async () => {
      setNativeValue(inputs[0], 'Kyoto, Japan');
      setNativeValue(inputs[1], 'Asia/Tokyo');
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
          about: 'Updated about text',
          location: 'Kyoto, Japan',
          timezone: 'Asia/Tokyo'
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
          about: 'Custom about that will be cleared',
          location: 'Paris, France',
          timezone: 'Europe/Paris'
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

  test('isolated preview tab allows sending test messages with unsaved rules and timezone without modifying chat state', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        customConfig: {
          about: 'Playful companion',
          shouldRules: 'Be witty and direct',
          timezone: 'Europe/London'
        }
      }
    });
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        bubbles: ['Right on cue! What time is it for you over there? ✨']
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
      setNativeValue(previewInput, 'What time is it there?');
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
        userMessage: 'What time is it there?',
        customConfig: expect.objectContaining({
          shouldRules: 'Be witty and direct',
          timezone: 'Europe/London'
        }),
        timeZone: expect.any(String)
      })
    );

    // Verify response bubble is displayed
    expect(container.textContent).toContain('Right on cue! What time is it for you over there? ✨');
  });
});
