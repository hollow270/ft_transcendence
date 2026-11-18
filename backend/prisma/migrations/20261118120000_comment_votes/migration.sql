-- AlterTable
ALTER TABLE "comments" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "comment_votes" (
	"comment_id" UUID NOT NULL,
	"user_id" UUID NOT NULL,
	"value" INTEGER NOT NULL,
	"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "comment_votes_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateIndex
CREATE INDEX "comment_votes_user_id_idx" ON "comment_votes"("user_id");

-- CreateIndex
CREATE INDEX "comments_artifact_id_score_idx" ON "comments"("artifact_id", "score");

-- AddForeignKey
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
