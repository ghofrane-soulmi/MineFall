/** Token colours. Player 1 is red, player 2 is yellow. */
export type Color = 'red' | 'yellow';

/** A board coordinate. `row` 0 is the top row. */
export interface Cell {
  readonly col: number;
  readonly row: number;
}

/** A board cell content: a token colour or empty. */
export type CellContent = Color | null;

/** The grid, indexed as `board[row][col]`. Treated as immutable by the engine. */
export type Board = readonly (readonly CellContent[])[];
