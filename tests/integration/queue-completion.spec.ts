import { expect, openMockVideo, openQueue, resetExtensionStorage, test } from './fixtures';

function timestampToSeconds(timestamp: string): number {
  return timestamp
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

async function finishLastQueueChapter(page: import('@playwright/test').Page): Promise<void> {
  const panel = page.locator('#chapshuffle-queue');
  let rows = panel.locator('.chapshuffle-item');
  const starts = (await panel.locator('.chapshuffle-time').allTextContents()).map(
    timestampToSeconds
  );
  const finalVideoChapterStart = Math.max(...starts);
  const queueEndIndex = starts.findIndex((start) => start < finalVideoChapterStart);
  const lastIndex = starts.length - 1;

  if (queueEndIndex !== lastIndex) {
    await rows.nth(queueEndIndex).dragTo(rows.nth(lastIndex));
    rows = panel.locator('.chapshuffle-item');
  }

  const lastRow = rows.nth(lastIndex);
  await lastRow.click();

  const activeStart = timestampToSeconds(await lastRow.locator('.chapshuffle-time').innerText());
  const chapterStarts = (await panel.locator('.chapshuffle-time').allTextContents())
    .map(timestampToSeconds)
    .sort((a, b) => a - b);
  const nextBoundary = chapterStarts.find((start) => start > activeStart);
  const boundary =
    nextBoundary ??
    (await page.locator('video').evaluate((video) => (video as HTMLVideoElement).duration - 1));

  await page.locator('video').evaluate((video, currentTime) => {
    (video as HTMLVideoElement).currentTime = currentTime;
    video.dispatchEvent(new Event('timeupdate'));
  }, activeStart);

  await page.locator('video').evaluate((video, currentTime) => {
    (video as HTMLVideoElement).currentTime = currentTime;
    video.dispatchEvent(new Event('timeupdate'));
  }, boundary);
}

test('queue reshuffles after the final chapter when configured', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: true,
    tutorialComplete: true,
    minChapters: 5,
    queueEndBehavior: 'reshuffle',
  });
  await openMockVideo(page);
  await openQueue(page);

  const titles = page.locator('#chapshuffle-queue .chapshuffle-title');
  const before = await titles.allTextContents();
  await finishLastQueueChapter(page);

  await expect(page.locator('.chapshuffle-item.chapshuffle-active')).toHaveAttribute(
    'data-index',
    '0'
  );
  await expect.poll(() => titles.allTextContents()).not.toEqual(before);
});

test('video ends after the final chapter when configured', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: true,
    tutorialComplete: true,
    minChapters: 5,
    queueEndBehavior: 'end-video',
  });
  await openMockVideo(page);
  await openQueue(page);
  await finishLastQueueChapter(page);

  const playback = await page.locator('video').evaluate((video) => ({
    currentTime: (video as HTMLVideoElement).currentTime,
    duration: (video as HTMLVideoElement).duration,
  }));
  expect(playback.currentTime).toBe(playback.duration);
});
