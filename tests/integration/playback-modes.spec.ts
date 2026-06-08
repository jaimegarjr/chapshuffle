import { expect, openMockVideo, openQueue, resetExtensionStorage, test } from './fixtures';

function timestampToSeconds(timestamp: string): number {
  return timestamp
    .split(':')
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

async function advancePastActiveChapter(page: import('@playwright/test').Page): Promise<void> {
  const panel = page.locator('#chapshuffle-queue');
  const activeStart = timestampToSeconds(
    await panel.locator('.chapshuffle-item.chapshuffle-active .chapshuffle-time').innerText()
  );
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
  }, boundary);
}

test('user can toggle loop mode for the current chapter', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: true,
    tutorialComplete: true,
    minChapters: 5,
  });
  await openMockVideo(page);
  await openQueue(page);

  const activeRow = page.locator('#chapshuffle-queue .chapshuffle-item.chapshuffle-active');
  const activeTitle = await activeRow.locator('.chapshuffle-title').innerText();
  const activeStart = timestampToSeconds(await activeRow.locator('.chapshuffle-time').innerText());
  await activeRow.click();
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).currentTime))
    .toBe(activeStart);
  await expect(page.locator('.ytp-time-current')).toHaveText(
    `${Math.floor(activeStart / 60)}:${String(activeStart % 60).padStart(2, '0')}`
  );

  const loopButton = page.locator('#chapshuffle-loop');
  await expect(loopButton).toHaveAttribute('aria-pressed', 'false');
  await loopButton.click();
  await expect(loopButton).toHaveAttribute('aria-pressed', 'true');

  await advancePastActiveChapter(page);

  await expect(page.locator('.chapshuffle-item.chapshuffle-active .chapshuffle-title')).toHaveText(
    activeTitle
  );
  await expect
    .poll(() => page.locator('video').evaluate((video) => (video as HTMLVideoElement).currentTime))
    .toBe(activeStart);
});

test('auto-advance follows the shuffled queue when enabled', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: true,
    tutorialComplete: true,
    minChapters: 5,
  });
  await openMockVideo(page);
  await openQueue(page);

  const rows = page.locator('#chapshuffle-queue .chapshuffle-item');
  const nextTitle = await rows.nth(1).locator('.chapshuffle-title').innerText();
  await advancePastActiveChapter(page);

  await expect(page.locator('.chapshuffle-item.chapshuffle-active .chapshuffle-title')).toHaveText(
    nextTitle
  );
});

test('playback remains linear when auto-advance is disabled', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: false,
    tutorialComplete: true,
    minChapters: 5,
  });
  await openMockVideo(page);
  await openQueue(page);

  const activeTitle = await page
    .locator('.chapshuffle-item.chapshuffle-active .chapshuffle-title')
    .innerText();
  await advancePastActiveChapter(page);

  await expect(page.locator('.chapshuffle-item.chapshuffle-active .chapshuffle-title')).toHaveText(
    activeTitle
  );
});
