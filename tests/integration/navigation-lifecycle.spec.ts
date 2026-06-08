import {
  expect,
  navigateToMockVideo,
  NO_CHAPTER_VIDEO_ID,
  openMockVideo,
  openQueue,
  resetExtensionStorage,
  SECONDARY_VIDEO_ID,
  test,
} from './fixtures';

test('queue is replaced when YouTube navigates to another chaptered video', async ({
  page,
  extensionId,
}) => {
  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openMockVideo(page);
  await openQueue(page);

  const firstQueueTitles = await page
    .locator('#chapshuffle-queue .chapshuffle-title')
    .allTextContents();
  await page.evaluate(() => {
    document.documentElement.dataset.chapshuffleSpaMarker = 'present';
    document.querySelector('#chapshuffle-btn')?.setAttribute('data-old-video', 'true');
  });

  await navigateToMockVideo(page, SECONDARY_VIDEO_ID);

  await expect(page).toHaveURL(new RegExp(`watch\\?v=${SECONDARY_VIDEO_ID}`));
  await expect(page.locator('html')).toHaveAttribute('data-chapshuffle-spa-marker', 'present');
  await expect(page.locator('#chapshuffle-btn[data-old-video="true"]')).toHaveCount(0);
  await expect(page.locator('#chapshuffle-btn')).toBeVisible({ timeout: 10_000 });
  await openQueue(page);

  const secondTitles = page.locator('#chapshuffle-queue .chapshuffle-title');
  await expect(secondTitles).toHaveCount(5);
  expect(await secondTitles.allTextContents()).not.toEqual(firstQueueTitles);
});

test('extension stays hidden on a video with too few chapters', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await page.goto(`https://www.youtube.com/watch?v=${NO_CHAPTER_VIDEO_ID}`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page.locator('video')).toBeVisible();
  await expect(page.locator('#chapshuffle-btn')).toHaveCount(0, { timeout: 2_000 });
});
