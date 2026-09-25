import api from './api';
import { uploadSharedPhoto, loadSharedPhoto } from './sharedPhotos';

jest.mock('./api', () => ({ post: jest.fn(), put: jest.fn(), get: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('shared photo uses Vercel REST chunks without a socket', async () => {
  const input = `data:image/png;base64,${'A'.repeat(1024 * 1024 + 32)}`;
  api.post.mockResolvedValueOnce({ data: { uploadId: 'upload-1' } }).mockResolvedValueOnce({ data: { photo: { _id: 'upload-1', chunkCount: 2 } } });
  api.put.mockResolvedValue({ data: { ok: true } });
  const photo = await uploadSharedPhoto(input, { caption: 'test' });
  expect(photo._id).toBe('upload-1');
  expect(api.put).toHaveBeenCalledTimes(2);
  expect(api.put.mock.calls.map(call => call[1].data).join('')).toBe(input);
  expect(api.post.mock.calls[0][0]).toBe('/private-space/shared-photos/uploads');
});

test('metadata is reconciled to media without duplicate upload', async () => {
  api.get.mockResolvedValueOnce({ data: { data: 'data:image/png;base64,' } }).mockResolvedValueOnce({ data: { data: 'AAAA' } });
  const loaded = await loadSharedPhoto({ _id: 'photo-1', chunkCount: 2, uploadedBy: { _id: 'owner' } }, 'friend');
  expect(loaded.dataUrl).toBe('data:image/png;base64,AAAA');
  expect(api.post).not.toHaveBeenCalled();
});

test('hidden friend media is not fetched', async () => {
  const hidden = { _id: 'photo-2', chunkCount: 2, isHidden: true, uploadedBy: { _id: 'owner' } };
  expect(await loadSharedPhoto(hidden, 'friend')).toBe(hidden);
  expect(api.get).not.toHaveBeenCalled();
});
