-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'DEPLOYED', 'FAILED');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- AlterTable: campaigns — add deployment tracking columns
ALTER TABLE "campaigns"
  ADD COLUMN "deployment_status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "contract_tx_hash" TEXT;

-- AlterTable: donations — make tx_hash/donor_wallet nullable, add new columns
ALTER TABLE "donations"
  ALTER COLUMN "tx_hash"      DROP NOT NULL,
  ALTER COLUMN "donor_wallet" DROP NOT NULL,
  ADD COLUMN "user_id"    TEXT,
  ADD COLUMN "tx_status"  "TxStatus"       NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "amount_usd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey: donations.user_id -> users.id
ALTER TABLE "donations"
  ADD CONSTRAINT "donations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: donations.user_id
CREATE INDEX "donations_user_id_idx" ON "donations"("user_id");

-- CreateTable: withdrawals
CREATE TABLE "withdrawals" (
  "id"           TEXT          NOT NULL,
  "campaign_id"  TEXT          NOT NULL,
  "user_id"      TEXT          NOT NULL,
  "amount_usdc"  DECIMAL(20,6) NOT NULL,
  "platform_fee" DECIMAL(20,6) NOT NULL,
  "net_amount"   DECIMAL(20,6) NOT NULL,
  "tx_hash"      TEXT,
  "tx_status"    "TxStatus"    NOT NULL DEFAULT 'PENDING',
  "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: withdrawals.campaign_id -> campaigns.id
ALTER TABLE "withdrawals"
  ADD CONSTRAINT "withdrawals_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: withdrawals.user_id -> users.id
ALTER TABLE "withdrawals"
  ADD CONSTRAINT "withdrawals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex: withdrawals.tx_hash (unique, PostgreSQL allows multiple NULLs)
CREATE UNIQUE INDEX "withdrawals_tx_hash_key" ON "withdrawals"("tx_hash");

-- CreateIndex: withdrawals.campaign_id
CREATE INDEX "withdrawals_campaign_id_idx" ON "withdrawals"("campaign_id");

-- CreateIndex: withdrawals.user_id
CREATE INDEX "withdrawals_user_id_idx" ON "withdrawals"("user_id");
