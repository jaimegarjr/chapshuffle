import { expect, openMockVideo, openQueue, resetExtensionStorage, test } from './fixtures';

test('excluded chapters persist for the video and can be restored', async ({
  page,
  extensionId,
}) => {
  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openMockVideo(page);
  await openQueue(page);

  const panel = page.locator('#chapshuffle-queue');
  const queueRows = panel.locator('.chapshuffle-item');
  const initialCount = await queueRows.count();

  await panel.locator('#chapshuffle-edit-exclusions').click();
  const exclusionRows = panel.locator('.chapshuffle-exclusion-row');
  const excludedTitle = await exclusionRows.nth(1).locator('.chapshuffle-title').innerText();
  await exclusionRows.nth(1).click();
  await panel.locator('#chapshuffle-exclusion-done').click();

  await expect(queueRows).toHaveCount(initialCount - 1);
  await expect(panel.getByText(excludedTitle, { exact: true })).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#chapshuffle-btn')).toBeVisible({ timeout: 10_000 });
  await openQueue(page);
  await expect(page.locator('#chapshuffle-queue .chapshuffle-item')).toHaveCount(initialCount - 1);

  await page.locator('#chapshuffle-edit-exclusions').click();
  await page.locator('#chapshuffle-clear-exclusions').click();
  await page.locator('#chapshuffle-exclusion-done').click();
  await expect(page.locator('#chapshuffle-queue .chapshuffle-item')).toHaveCount(initialCount);
});

test('the final included chapter cannot be excluded', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId, { tutorialComplete: true, minChapters: 5 });
  await openMockVideo(page);
  await openQueue(page);
  await page.locator('#chapshuffle-edit-exclusions').click();

  const rows = page.locator('#chapshuffle-queue .chapshuffle-exclusion-row');
  const rowCount = await rows.count();
  for (let index = 0; index < rowCount - 1; index++) {
    await rows.nth(index).click();
  }

  const finalIncludedRow = rows.nth(rowCount - 1);
  await expect(finalIncludedRow).toHaveAttribute('aria-disabled', 'true');
  await finalIncludedRow.click();
  await expect(finalIncludedRow).toHaveAttribute('aria-pressed', 'false');
});
