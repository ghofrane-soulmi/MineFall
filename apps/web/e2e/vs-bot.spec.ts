/** F13: one visitor alone plays a full game against Minebot. */
import { expect, test } from '@playwright/test';

test('a solo visitor plays a full game against Minebot', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nickname-input').fill('Solo');
  await page.getByTestId('nickname-submit').click();
  await page.getByTestId('play-bot-normal').click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}$/);

  // No lobby: straight to the dice, then mine placement.
  const dice = page.getByTestId('dice-roll');
  await dice.click();
  await expect(dice).toBeHidden();
  await expect(page.getByTestId('player-opponent')).toContainText('Minebot');
  await page.getByTestId('cell-0-1').click();
  await page.getByTestId('cell-6-1').click();
  await page.getByTestId('confirm-mines').click();

  // Play the first available column on each of our turns until the game ends.
  const status = page.getByTestId('status');
  const endTitle = page.getByTestId('end-title');
  for (let turn = 0; turn < 30; turn++) {
    // Wait until it is our turn or the game is over ("Game over" in the status line).
    await expect(status).toHaveText(/Your turn|Game over/, { timeout: 15_000 });
    if ((await status.textContent())?.includes('Game over')) break;
    await page.locator('[data-testid^="column-"]:not([disabled])').first().click();
    await expect(status).not.toHaveText(/Your turn/);
  }

  await expect(endTitle).toHaveText(/You win!|You lose|Draw!/);
  await expect(page.getByTestId('rematch')).toHaveText('Play again');
});
