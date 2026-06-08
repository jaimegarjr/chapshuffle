import { expect, openMockVideo, openQueue, resetExtensionStorage, test } from './fixtures';

test('injects a populated queue into the mocked YouTube player', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openMockVideo(page);
  await openQueue(page);

  const panel = page.locator('#chapshuffle-queue');
  await expect(panel.locator('#chapshuffle-queue-title')).toHaveText('Shuffle Queue');
  await expect(panel.locator('.chapshuffle-item')).toHaveCount(6);
});
