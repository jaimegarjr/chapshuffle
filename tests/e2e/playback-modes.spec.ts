import { expect, openChapteredVideo, openQueue, resetExtensionStorage, test } from './fixtures';

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
    const media = video as HTMLVideoElement;
    media.currentTime = currentTime;
    media.dispatchEvent(new Event('timeupdate'));
  }, boundary);
}

test('user can toggle loop mode for the current chapter', async ({ page, extensionId }) => {
  test.setTimeout(90_000);

  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: true,
    tutorialComplete: true,
    minChapters: 5,
  });
  await openChapteredVideo(page);
  await openQueue(page);

  const activeRow = page.locator('#chapshuffle-queue .chapshuffle-item.chapshuffle-active');
  const activeTitle = await activeRow.locator('.chapshuffle-title').innerText();
  const activeStart = timestampToSeconds(await activeRow.locator('.chapshuffle-time').innerText());
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
    .toBeLessThanOrEqual(activeStart + 2);
});

test('auto-advance follows the shuffled queue when enabled', async ({ page, extensionId }) => {
  test.setTimeout(90_000);

  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: true,
    tutorialComplete: true,
    minChapters: 5,
  });
  await openChapteredVideo(page);
  await openQueue(page);

  const rows = page.locator('#chapshuffle-queue .chapshuffle-item');
  const nextTitle = await rows.nth(1).locator('.chapshuffle-title').innerText();
  await advancePastActiveChapter(page);

  await expect(page.locator('.chapshuffle-item.chapshuffle-active .chapshuffle-title')).toHaveText(
    nextTitle
  );
});

test('playback remains linear when auto-advance is disabled', async ({ page, extensionId }) => {
  test.setTimeout(90_000);

  await resetExtensionStorage(page, extensionId, {
    shuffleEnabled: false,
    tutorialComplete: true,
    minChapters: 5,
  });
  await openChapteredVideo(page);
  await openQueue(page);

  const activeTitle = await page
    .locator('.chapshuffle-item.chapshuffle-active .chapshuffle-title')
    .innerText();
  await advancePastActiveChapter(page);

  await expect(page.locator('.chapshuffle-item.chapshuffle-active .chapshuffle-title')).toHaveText(
    activeTitle
  );
});
