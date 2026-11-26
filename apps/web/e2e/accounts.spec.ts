/**
 * F15 + F16: a guest plays, sees their stats, creates an account, logs out and logs back in.
 * Needs a database (DATABASE_URL), like the CI end-to-end job provides.
 */
import { expect, test } from '@playwright/test';

test.skip(!process.env['DATABASE_URL'], 'needs DATABASE_URL (accounts and stats use PostgreSQL)');

test('guest stats, then account creation, logout and login on "another device"', async ({
  page,
  browser,
}) => {
  const email = `e2e-${Date.now()}@minefall.test`;
  const password = 'e2e-password';

  // 1. Play as a guest against Minebot, then quit: the forfeit is saved as a loss.
  await page.goto('/');
  await page.getByTestId('nickname-input').fill('Statty');
  await page.getByTestId('nickname-submit').click();
  await page.getByTestId('play-bot-easy').click();
  await page.getByTestId('dice-roll').click();
  page.once('dialog', (dialog) => void dialog.accept()); // "Leaving now counts as a forfeit"
  await page.getByTestId('leave-game').click();
  await expect(page).toHaveURL(/\/$/);

  // 2. Guests have stats too.
  await page.getByTestId('nav-profile').click();
  await expect(page).toHaveURL(/profile$/); // the page is lazy-loaded: wait before reloading
  await expect
    .poll(async () => {
      await page.reload();
      return page.getByTestId('stat-games').textContent();
    })
    .toContain('1');
  await expect(page.getByTestId('stat-losses')).toContainText('1');
  await expect(page.getByTestId('recent-games')).toContainText('Minebot');

  // 3. Create an account from the stats page.
  await page.getByTestId('account-email').fill(email);
  await page.getByTestId('account-password').fill(password);
  await page.getByTestId('account-submit').click();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('nickname-input')).toBeVisible();

  // 4. Another device: log in, same nickname, same stats.
  const other = await (await browser.newContext()).newPage();
  await other.goto('/');
  await other.getByTestId('go-login').click();
  await other.getByTestId('account-email').fill(email);
  await other.getByTestId('account-password').fill('wrong-password');
  await other.getByTestId('account-submit').click();
  await expect(other.getByTestId('account-error')).toContainText('Wrong email or password');
  await other.getByTestId('account-password').fill(password);
  await other.getByTestId('account-submit').click();
  await expect(other.getByTestId('greeting')).toHaveText('Statty');
  await other.getByTestId('nav-profile').click();
  await expect(other.getByTestId('stat-games')).toContainText('1');
});
