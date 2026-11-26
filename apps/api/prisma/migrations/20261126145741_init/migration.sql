-- CreateEnum
CREATE TYPE "GameResultType" AS ENUM ('win', 'draw', 'forfeit');

-- CreateEnum
CREATE TYPE "MoveOutcome" AS ENUM ('placed', 'exploded');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nickname" VARCHAR(16) NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "is_guest" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "room_code" VARCHAR(6) NOT NULL,
    "player1_id" UUID NOT NULL,
    "player2_id" UUID NOT NULL,
    "winner_id" UUID,
    "result" "GameResultType" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_mines" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "col" SMALLINT NOT NULL,
    "row" SMALLINT NOT NULL,
    "exploded" BOOLEAN NOT NULL,
    "exploded_at_move" SMALLINT,

    CONSTRAINT "game_mines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_moves" (
    "id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "move_number" SMALLINT NOT NULL,
    "player_id" UUID NOT NULL,
    "column" SMALLINT NOT NULL,
    "landed_row" SMALLINT NOT NULL,
    "outcome" "MoveOutcome" NOT NULL,
    "timed_out" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "games_player1_id_idx" ON "games"("player1_id");

-- CreateIndex
CREATE INDEX "games_player2_id_idx" ON "games"("player2_id");

-- CreateIndex
CREATE INDEX "games_ended_at_idx" ON "games"("ended_at");

-- CreateIndex
CREATE INDEX "game_mines_game_id_idx" ON "game_mines"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_moves_game_id_move_number_key" ON "game_moves"("game_id", "move_number");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_mines" ADD CONSTRAINT "game_mines_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_mines" ADD CONSTRAINT "game_mines_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_moves" ADD CONSTRAINT "game_moves_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
