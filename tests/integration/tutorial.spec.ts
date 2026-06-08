import { expect, openMockVideo, resetExtensionStorage, test } from './fixtures';

const TUTORIAL_MESSAGES = [
  'Click the shuffle button to open your chapter queue.',
  'This is your shuffle queue — chapters play in a randomized order.',
  'Use the arrows to jump to the previous or next chapter.',
  'Hit Reshuffle to get a brand new random chapter order.',
  'Hit Loop to repeat the current chapter on a loop until you turn it off.',
  'Drag any chapter row to set your own custom play order.',
  'Open exclusion mode when you want to choose which chapters shuffle can play.',
  'In exclusion mode, rows toggle inclusion and Done returns you to the queue.',
  'All set! Find more options — like auto-advance — in the extension menu.',
] as const;

test('first-time user can skip the tutorial and it stays completed', async ({
  page,
  extensionId,
}) => {
  await resetExtensionStorage(page, extensionId, { minChapters: 5 });
  await openMockVideo(page);

  const tutorial = page.locator('#chapshuffle-tutorial');
  await expect(tutorial).toBeVisible();
  await expect(page.locator('#chapshuffle-tutorial-message')).toHaveText(TUTORIAL_MESSAGES[0]);

  await page.locator('#chapshuffle-tutorial-skip').click();
  await expect(tutorial).toBeHidden();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#chapshuffle-btn')).toBeVisible({ timeout: 10_000 });
  await expect(tutorial).toHaveCount(0);
});

test('first-time user can complete the tutorial flow and it stays completed', async ({
  page,
  extensionId,
}) => {
  await resetExtensionStorage(page, extensionId, { minChapters: 5 });
  await openMockVideo(page);

  const tutorial = page.locator('#chapshuffle-tutorial');
  const tutorialMessage = page.locator('#chapshuffle-tutorial-message');
  const tutorialNext = page.locator('#chapshuffle-tutorial-next');
  const queue = page.locator('#chapshuffle-queue');
  const toggle = page.locator('#chapshuffle-btn');

  await expect(tutorial).toBeVisible();
  await expect(tutorialMessage).toHaveText(TUTORIAL_MESSAGES[0]);

  await toggle.click();
  await expect(tutorialMessage).toHaveText(TUTORIAL_MESSAGES[1]);
  await expect(queue).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  for (const message of TUTORIAL_MESSAGES.slice(2, -1)) {
    await tutorialNext.click();
    await expect(tutorialMessage).toHaveText(message);
  }

  await tutorialNext.click();
  await expect(tutorialMessage).toHaveText(TUTORIAL_MESSAGES.at(-1) ?? '');
  await expect(tutorialNext).toHaveText('Done');

  await tutorialNext.click();
  await expect(tutorial).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#chapshuffle-btn')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#chapshuffle-tutorial')).toHaveCount(0);
});
