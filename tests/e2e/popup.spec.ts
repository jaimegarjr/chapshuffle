import { expect, resetExtensionStorage, test } from './fixtures';

test('popup settings persist across extension page reloads', async ({ page, extensionId }) => {
  await resetExtensionStorage(page, extensionId);

  const shuffleRow = page.locator('.row', { hasText: 'Enable shuffle' });
  const shuffleToggle = shuffleRow.getByRole('checkbox');
  await expect(shuffleToggle).not.toBeChecked();
  await shuffleRow.locator('.switch').click();
  await expect(shuffleToggle).toBeChecked();

  await expect(page.locator('.step-value')).toHaveText('5');
  await page.getByRole('button', { name: '+' }).click();
  await page.getByRole('button', { name: 'End video' }).click();

  await page.reload();

  await expect(shuffleToggle).toBeChecked();
  await expect(page.locator('.step-value')).toHaveText('6');
  await expect(page.getByRole('button', { name: 'End video' })).toHaveClass(/seg-active/);
});
