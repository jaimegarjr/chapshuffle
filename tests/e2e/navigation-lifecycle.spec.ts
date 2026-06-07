import {
  dismissYouTubeAd,
  expect,
  NO_CHAPTER_VIDEO_URL,
  openChapteredVideo,
  openQueue,
  resetExtensionStorage,
  SECOND_YOUTUBE_VIDEO_ID,
  test,
} from './fixtures';

test('queue is replaced when YouTube navigates to another chaptered video', async ({
  page,
  extensionId,
}) => {
  test.setTimeout(120_000);

  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openChapteredVideo(page);
  await openQueue(page);

  const firstQueueTitles = await page
    .locator('#chapshuffle-queue .chapshuffle-title')
    .allTextContents();
  await page.evaluate(() => {
    document.documentElement.dataset.chapshuffleSpaMarker = 'present';
    document.querySelector('#chapshuffle-btn')?.setAttribute('data-old-video', 'true');
  });

  const searchBox = page.locator('input[name="search_query"]');
  await searchBox.fill(SECOND_YOUTUBE_VIDEO_ID);
  await searchBox.press('Enter');

  const secondVideoLink = page.locator(`a#video-title[href*="watch?v=${SECOND_YOUTUBE_VIDEO_ID}"]`);
  await expect(secondVideoLink).toBeVisible({ timeout: 60_000 });
  await secondVideoLink.click();
  await expect(page).toHaveURL(new RegExp(`watch\\?v=${SECOND_YOUTUBE_VIDEO_ID}`), {
    timeout: 60_000,
  });
  await dismissYouTubeAd(page);

  await expect(page.locator('html')).toHaveAttribute('data-chapshuffle-spa-marker', 'present');
  await expect(page.locator('#chapshuffle-btn[data-old-video="true"]')).toHaveCount(0, {
    timeout: 60_000,
  });
  await expect(page.locator('#chapshuffle-btn')).toBeVisible({ timeout: 60_000 });
  await openQueue(page);

  const secondTitles = page.locator('#chapshuffle-queue .chapshuffle-title');
  await expect.poll(() => secondTitles.count(), { timeout: 60_000 }).toBeGreaterThanOrEqual(5);
  const secondQueueTitles = await secondTitles.allTextContents();
  expect(secondQueueTitles.length).toBeGreaterThanOrEqual(5);
  expect(secondQueueTitles).not.toEqual(firstQueueTitles);
});

test('extension stays hidden on a video with too few chapters', async ({ page, extensionId }) => {
  test.setTimeout(90_000);

  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await page.goto(NO_CHAPTER_VIDEO_URL, { waitUntil: 'domcontentloaded' });
  await dismissYouTubeAd(page);

  await expect(page.locator('video')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#chapshuffle-btn')).toHaveCount(0, { timeout: 5_000 });
});
