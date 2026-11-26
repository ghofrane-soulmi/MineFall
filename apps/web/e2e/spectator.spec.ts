/** F18: a third person opens the link of a full room and watches the game live. */
import { expect, test, type Page } from '@playwright/test';

async function enterNickname(page: Page, nickname: string): Promise<void> {
  await page.getByTestId('nickname-input').fill(nickname);
  await page.getByTestId('nickname-submit').click();
}

async function skipDice(page: Page): Promise<void> {
  const dice = page.getByTestId('dice-roll');
  if (await dice.isVisible()) await dice.click();
  await expect(dice).toBeHidden();
}

test('a spectator watches a game live, read-only, without seeing mines', async ({ browser }) => {
  const newPage = async (): Promise<Page> => (await browser.newContext()).newPage();
  const alice = await newPage();
  const bob = await newPage();
  const viewer = await newPage();

  await alice.goto('/');
  await enterNickname(alice, 'Alice');
  await alice.getByTestId('create-room').click();
  await expect(alice).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  const url = alice.url();

  await bob.goto(url);
  await enterNickname(bob, 'Bob');
  await alice.getByTestId('ready').click();
  await bob.getByTestId('ready').click();
  await skipDice(alice);
  await skipDice(bob);

  // The room is full: the third visitor is offered to watch.
  await viewer.goto(url);
  await enterNickname(viewer, 'Viewer');
  await expect(viewer.getByTestId('join-error')).toContainText('already has two players');
  await viewer.getByTestId('watch-room').click();
  await expect(viewer.getByTestId('watchers')).toContainText('You are watching');
  await expect(alice.getByTestId('watchers')).toContainText('1 watching');

  // Both players hide mines; the spectator never sees any mine marker or placement cell.
  const placements: [Page, string[]][] = [
    [alice, ['cell-5-1', 'cell-6-1']],
    [bob, ['cell-0-1', 'cell-1-1']],
  ];
  for (const [page, cells] of placements) {
    for (const cell of cells) await page.getByTestId(cell).click();
    await page.getByTestId('confirm-mines').click();
  }
  await expect(viewer.getByTestId('status')).toHaveText(/'s turn/);
  await expect(viewer.locator('[data-testid^="cell-"]')).toHaveCount(0);
  await expect(viewer.locator('[data-testid^="column-"]')).toHaveCount(0);

  // A move appears live on the spectator's board.
  const first = /Your turn/.test((await alice.getByTestId('status').textContent()) ?? '')
    ? alice
    : bob;
  await first.getByTestId('column-3').click();
  await expect(viewer.getByTestId('board').locator('[data-testid^="token-"]')).toHaveCount(1);

  // Read-only chat, and "Stop watching" leaves without affecting the game.
  await expect(viewer.getByText('Spectators can read the chat but not write.')).toBeVisible();
  await viewer.getByTestId('leave-game').click();
  await expect(viewer).toHaveURL(/\/$/);
  await expect(alice.getByTestId('watchers')).toBeHidden();
});
