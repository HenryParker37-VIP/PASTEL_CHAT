import { prepareLyraAvatarUpload, resolveAvatarAsset } from './lyraAvatarMedia';

describe('Lyra avatar media', () => {
  test('resolves versioned media paths against the current frontend origin', () => {
    expect(resolveAvatarAsset('/ai/avatar/media/abc123', 'https://pastel-chat.vercel.app'))
      .toBe('https://pastel-chat.vercel.app/ai/avatar/media/abc123');
    expect(resolveAvatarAsset('https://images.example/photo.jpg')).toBe('https://images.example/photo.jpg');
    expect(resolveAvatarAsset('blob:preview')).toBe('blob:preview');
  });

  test('resizes mobile photos and returns an immediate object URL preview plus JPEG upload', async () => {
    const originalImage = global.Image;
    const createObjectURL = URL.createObjectURL;
    const revokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    const drawImage = jest.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL: jest.fn(() => 'data:image/jpeg;base64,encoded-photo')
    };
    global.Image = class TestImage {
      naturalWidth = 1600;
      naturalHeight = 800;
      set src(value) { this._src = value; Promise.resolve().then(() => this.onload()); }
    };
    URL.createObjectURL = jest.fn(() => 'blob:avatar-preview');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((name, options) => name === 'canvas' ? canvas : originalCreateElement(name, options));

    try {
      const result = await prepareLyraAvatarUpload({ type: 'image/heic', size: 1024 });
      expect(result.previewUrl).toBe('blob:avatar-preview');
      expect(result.dataUrl).toBe('data:image/jpeg;base64,encoded-photo');
      expect(canvas.width).toBe(512);
      expect(canvas.height).toBe(256);
      expect(drawImage).toHaveBeenCalledTimes(1);
      result.dispose();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar-preview');
    } finally {
      global.Image = originalImage;
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = revokeObjectURL;
      document.createElement.mockRestore();
    }
  });
});
