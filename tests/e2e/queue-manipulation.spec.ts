import { expect, openChapteredVideo, openQueue, resetExtensionStorage, test } from './fixtures';

test('user can reshuffle and reorder the queue', async ({ page, extensionId }) => {
  test.setTimeout(90_000);

  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openChapteredVideo(page);
  await openQueue(page);

  const panel = page.locator('#chapshuffle-queue');
  const titles = panel.locator('.chapshuffle-title');
  const beforeReshuffle = await titles.allTextContents();

  await panel.locator('#chapshuffle-reshuffle').click();
  await expect(panel.locator('.chapshuffle-item.chapshuffle-active')).toHaveCount(1);
  await expect.poll(() => titles.allTextContents()).not.toEqual(beforeReshuffle);

  const beforeReorder = await titles.allTextContents();
  const rows = panel.locator('.chapshuffle-item');
  await rows.nth(0).dragTo(rows.nth(1));
  await expect
    .poll(() => titles.allTextContents())
    .toEqual([beforeReorder[1], beforeReorder[0], ...beforeReorder.slice(2)]);
});
