/** F14: two strangers click "Play now" and are put in the same game, no code to share. */
import { expect, test, type Page } from '@playwright/test';

async function playNow(page: Page, nickname: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('nickname-input').fill(nickname);
  await page.getByTestId('nickname-submit').click();
  await page.getByTestId('play-now').click();
}

test('two players click "Play now" and land in the same game', async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();

  await playNow(first, 'Early');
  await expect(first.getByTestId('quick-match')).toContainText('Searching for an opponent');

  await playNow(second, 'Late');

  // Both are sent to the same room, straight into the game (dice, then mine placement).
  await expect(first).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  await expect(second).toHaveURL(first.url());
  for (const page of [first, second]) {
    await expect(page.getByTestId('dice-roll')).toBeVisible();
    await expect(page.getByTestId('player-opponent')).toBeVisible();
  }
});

test('cancel stops the search', async ({ page }) => {
  await playNow(page, 'Shy');
  await expect(page.getByTestId('quick-match')).toBeVisible();
  await page.getByTestId('quick-match-cancel').click();
  await expect(page.getByTestId('play-now')).toBeVisible();
});
