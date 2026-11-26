<script setup lang="ts">
/**
 * The 7x6 board, drawn ONLY from server data. Three modes:
 * - placement: click cells to place/remove mines (never the top row)
 * - play: click (or ←/→ + Enter) a column to drop a token when it is your turn
 * - view: read-only (opponent's turn, game over)
 */
import {
  COLS,
  ROWS,
  type Board,
  type Cell,
  type Color,
  type ExplodedMine,
  type OwnedMine,
  type PlayerId,
} from '@minefall/shared';
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import type { LastMove } from '../../stores/game';
import MineIcon from './MineIcon.vue';
import TokenPiece from './TokenPiece.vue';

const props = defineProps<{
  board: Board;
  mode: 'placement' | 'play' | 'view';
  myColor: Color | null;
  ownMines: readonly Cell[];
  pendingMines: readonly Cell[];
  explodedMines: readonly ExplodedMine[];
  revealedMines: readonly OwnedMine[] | null;
  blockedColumns: Readonly<Record<number, number>>;
  winningLine: readonly Cell[] | null;
  lastMove: LastMove | null;
  colorOf: (playerId: PlayerId) => Color | null;
}>();

const emit = defineEmits<{
  drop: [column: number];
  toggleCell: [cell: Cell];
}>();

const columns = Array.from({ length: COLS }, (_, c) => c);
const rows = Array.from({ length: ROWS }, (_, r) => r);

const has = (cells: readonly Cell[] | null, col: number, row: number): boolean =>
  cells?.some((c) => c.col === col && c.row === row) ?? false;

const tokenAt = (col: number, row: number): Color | null => props.board[row]?.[col] ?? null;
const isBlocked = (col: number): boolean => (props.blockedColumns[col] ?? 0) > 0;
const isFull = (col: number): boolean => tokenAt(col, 0) !== null;
const canDropIn = (col: number): boolean => !isBlocked(col) && !isFull(col);

// --- Keyboard / hover: one roving tab stop for the 7 column buttons ---------------------
const activeColumn = ref(3);
const hoveredColumn = ref<number | null>(null);
const columnButtons = useTemplateRef<HTMLButtonElement[]>('columnButtons');
const ghostColumn = computed(() =>
  props.mode === 'play' ? (hoveredColumn.value ?? activeColumn.value) : null,
);

function onColumnKey(event: KeyboardEvent): void {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (step === 0) return;
  event.preventDefault();
  activeColumn.value = (activeColumn.value + step + COLS) % COLS;
  void nextTick(() => columnButtons.value?.[activeColumn.value]?.focus());
}

function onColumnClick(col: number): void {
  activeColumn.value = col;
  if (canDropIn(col)) emit('drop', col);
}

function columnLabel(col: number): string {
  const free = props.board.filter((row) => row[col] == null).length;
  if (isBlocked(col)) return `Column ${col + 1}, blocked after an explosion`;
  if (free === 0) return `Column ${col + 1}, full`;
  return `Column ${col + 1}, ${free} free ${free === 1 ? 'cell' : 'cells'}`;
}

// --- Animations driven by the last server move -----------------------------------------
const shaking = ref(false);
watch(
  () => props.lastMove?.seq,
  () => {
    if (props.lastMove?.outcome !== 'exploded') return;
    shaking.value = true;
    setTimeout(() => (shaking.value = false), 450);
  },
);

function dropRowsFor(col: number, row: number): number {
  const m = props.lastMove;
  return m && m.outcome === 'placed' && m.column === col && m.landedRow === row ? row + 1 : 0;
}

function isExplosionHere(col: number, row: number): boolean {
  const m = props.lastMove;
  return !!m && m.outcome === 'exploded' && m.column === col && m.landedRow === row;
}

function revealedVariant(col: number, row: number): 'revealed-red' | 'revealed-yellow' | null {
  const mine = props.revealedMines?.find((m) => m.col === col && m.row === row);
  if (!mine) return null;
  return props.colorOf(mine.ownerId) === 'red' ? 'revealed-red' : 'revealed-yellow';
}
</script>

<template>
  <div class="mx-auto w-full max-w-[560px] select-none">
    <!-- Ghost token above the hovered / focused column -->
    <div class="mb-1 grid grid-cols-7 gap-[2.5%] px-[2.5%]" aria-hidden="true">
      <div v-for="col in columns" :key="col" class="aspect-square p-[6%]">
        <TokenPiece
          v-if="ghostColumn === col && myColor && canDropIn(col)"
          :color="myColor"
          ghost
        />
      </div>
    </div>

    <div
      class="relative rounded-2xl border-b-8 border-board-edge bg-board p-[2.5%] shadow-2xl shadow-black/50"
      :class="shaking && 'animate-shake'"
    >
      <div
        class="grid grid-cols-7 gap-[2.5%]"
        data-testid="board"
        :role="mode === 'play' ? 'toolbar' : 'grid'"
        :aria-label="mode === 'placement' ? 'Board: choose your mine cells' : 'Board'"
        @mouseleave="hoveredColumn = null"
      >
        <div v-for="col in columns" :key="col" class="relative">
          <!-- Play mode: the whole column is one button -->
          <button
            v-if="mode === 'play'"
            ref="columnButtons"
            type="button"
            class="absolute inset-0 z-20 cursor-pointer rounded-xl transition-colors hover:bg-white/5 focus-visible:bg-white/10 disabled:cursor-not-allowed"
            :tabindex="activeColumn === col ? 0 : -1"
            :aria-label="columnLabel(col)"
            :disabled="!canDropIn(col)"
            :data-testid="`column-${col}`"
            @click="onColumnClick(col)"
            @keydown="onColumnKey"
            @mouseenter="hoveredColumn = col"
            @focus="activeColumn = col"
          />

          <div class="flex flex-col gap-[2.5%]">
            <div
              v-for="row in rows"
              :key="row"
              class="relative aspect-square overflow-hidden rounded-full bg-hole shadow-[inset_0_4px_8px_rgb(0_0_0/0.6)]"
            >
              <!-- Placement mode: each cell is a button -->
              <button
                v-if="mode === 'placement'"
                type="button"
                class="absolute inset-0 z-10 grid cursor-pointer place-items-center rounded-full transition hover:bg-mine/20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                :disabled="row === 0"
                :aria-label="`Row ${row + 1}, column ${col + 1}${row === 0 ? ' (no mines on the top row)' : ''}`"
                :aria-pressed="has(pendingMines, col, row)"
                :data-testid="`cell-${col}-${row}`"
                @click="emit('toggleCell', { col, row })"
              >
                <MineIcon v-if="has(pendingMines, col, row)" variant="pending" />
              </button>

              <div class="absolute inset-[6%]">
                <TokenPiece
                  v-if="tokenAt(col, row)"
                  :key="`${col}-${row}-${dropRowsFor(col, row) ? lastMove?.seq : 0}`"
                  :color="tokenAt(col, row) ?? 'red'"
                  :drop-rows="dropRowsFor(col, row)"
                  :winning="has(winningLine, col, row)"
                />
              </div>

              <!-- Mine markers (only data the server allowed us to see) -->
              <div class="pointer-events-none absolute inset-0 grid place-items-center">
                <MineIcon
                  v-if="revealedVariant(col, row)"
                  :variant="revealedVariant(col, row) ?? 'revealed-red'"
                />
                <MineIcon
                  v-else-if="mode !== 'placement' && has(ownMines, col, row) && !tokenAt(col, row)"
                  variant="own"
                />
                <MineIcon
                  v-else-if="has(explodedMines, col, row) && !tokenAt(col, row)"
                  variant="exploded"
                />
              </div>

              <!-- Explosion flash -->
              <div
                v-if="isExplosionHere(col, row)"
                :key="`boom-${lastMove?.seq}`"
                class="pointer-events-none absolute inset-0 z-30 rounded-full bg-[radial-gradient(circle,#fff_0%,#fde68a_30%,#f97316_60%,transparent_70%)] animate-flash"
              />
            </div>
          </div>

          <!-- Blocked column overlay -->
          <div
            v-if="isBlocked(col)"
            class="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-night/60"
          >
            <span
              class="mt-1 rounded-full bg-mine px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-night sm:text-xs"
            >
              Blocked<span class="hidden md:inline"> · 1 turn</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
