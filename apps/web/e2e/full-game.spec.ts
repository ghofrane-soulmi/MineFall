/**
 * SPEC section 8: "two browser contexts create, join and finish a game, including a page
 * refresh mid-game". Two contexts = two separate browsers (own storage, own guest session).
 */
import { expect, test, type Page } from '@playwright/test';

async function enterNickname(page: Page, nickname: string): Promise<void> {
  await page.getByTestId('nickname-input').fill(nickname);
  await page.getByTestId('nickname-submit').click();
}

/** Skips the dice animation if it is still on screen. */
async function skipDice(page: Page): Promise<void> {
  const dice = page.getByTestId('dice-roll');
  if (await dice.isVisible()) await dice.click();
  await expect(dice).toBeHidden();
}

async function hideMines(page: Page, cells: [number, number][]): Promise<void> {
  for (const [col, row] of cells) await page.getByTestId(`cell-${col}-${row}`).click();
  await page.getByTestId('confirm-mines').click();
}

/** Waits for my turn, then drops a token in `column`. */
async function play(page: Page, column: number): Promise<void> {
  await expect(page.getByTestId('status')).toHaveText(/Your turn/);
  await page.getByTestId(`column-${column}`).click();
  await expect(page.getByTestId('status')).not.toHaveText(/Your turn/);
}

const tokensOnBoard = (page: Page) => page.getByTestId('board').locator('[data-testid^="token-"]');

test('two players create, join, play with a refresh mid-game, and finish', async ({ browser }) => {
  const alice = await (await browser.newContext()).newPage();
  const bob = await (await browser.newContext()).newPage();

  // Alice creates a room.
  await alice.goto('/');
  await enterNickname(alice, 'Alice');
  await alice.getByTestId('create-room').click();
  await expect(alice).toHaveURL(/\/room\/[A-Z0-9]{6}$/);
  const code = (await alice.getByTestId('room-code').textContent())?.trim() ?? '';

  // Bob opens the shared link and joins.
  await bob.goto(`/room/${code}`);
  await enterNickname(bob, 'Bob');
  await expect(bob.getByTestId('room-code')).toHaveText(code);

  // Both ready -> dice -> placement.
  await alice.getByTestId('ready').click();
  await bob.getByTestId('ready').click();
  await skipDice(alice);
  await skipDice(bob);

  // Mines on row 1, far from where the game will be played.
  await hideMines(alice, [
    [5, 1],
    [6, 1],
  ]);
  await hideMines(bob, [
    [5, 2],
    [6, 2],
  ]);

  // Whoever the dice picked plays column 0, the other column 2.
  await expect(alice.getByTestId('status')).toHaveText(/Your turn|thinking/);
  const aliceFirst = /Your turn/.test((await alice.getByTestId('status').textContent()) ?? '');
  const [first, second] = aliceFirst ? [alice, bob] : [bob, alice];

  await play(first, 0);
  await play(second, 2);
  await play(first, 0);
  await play(second, 2);

  // Refresh mid-game: the second player gets the exact same board back.
  await second.reload();
  await expect(tokensOnBoard(second)).toHaveCount(4);
  await expect(second.getByTestId('status')).toHaveText(/thinking/);

  await play(first, 0);
  await play(second, 2);
  await play(first, 0); // 4 in a column -> win

  await expect(first.getByTestId('end-title')).toHaveText('You win!');
  await expect(second.getByTestId('end-title')).toHaveText('You lose');
  await expect(tokensOnBoard(second)).toHaveCount(7);
});
