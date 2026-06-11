import { expect, test, YOUTUBE_VIDEO_URL } from './fixtures';

test('fresh installation opens onboarding and Try Chap Shuffle replaces it with YouTube', async ({
  context,
  extensionId,
}) => {
  let onboarding = context
    .pages()
    .find((candidate) => candidate.url() === `chrome-extension://${extensionId}/onboarding.html`);
  if (!onboarding) {
    onboarding = await context.waitForEvent('page', {
      predicate: (candidate) =>
        candidate.url() === `chrome-extension://${extensionId}/onboarding.html`,
    });
  }

  await onboarding.waitForLoadState('domcontentloaded');
  const consent = onboarding.getByRole('checkbox', { name: 'Share anonymous usage metrics' });
  await expect(consent).not.toBeChecked();

  await onboarding.getByRole('button', { name: 'Try Chap Shuffle' }).click();
  await onboarding.waitForURL((url) => url.href.startsWith(YOUTUBE_VIDEO_URL.split('&')[0]), {
    waitUntil: 'domcontentloaded',
  });
  expect(onboarding.url()).toContain('youtube.com/watch?v=pgQRcqh1u7U');
});
