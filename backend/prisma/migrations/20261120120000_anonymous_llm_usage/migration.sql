-- DropForeignKey
ALTER TABLE "llm_usage_logs" DROP CONSTRAINT "llm_usage_logs_user_id_fkey";

-- DropIndex
DROP INDEX "llm_usage_logs_user_id_created_at_idx";

-- AlterTable
ALTER TABLE "llm_usage_logs" DROP COLUMN "user_id";

-- CreateIndex
CREATE INDEX "llm_usage_logs_created_at_idx" ON "llm_usage_logs"("created_at");
