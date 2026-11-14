-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('FILE', 'URL');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SubmissionSource" AS ENUM ('WEB', 'API');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScanReason" AS ENUM ('INITIAL', 'MANUAL_RESCAN', 'STALE_RESCAN', 'API_REQUEST');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('UNKNOWN', 'HARMLESS', 'SUSPICIOUS', 'MALICIOUS');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'ABUSIVE', 'DANGEROUS_MISINFORMATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('HIDE_COMMENT', 'RESTORE_COMMENT', 'DELETE_COMMENT', 'BAN_COMMENTING', 'UNBAN_COMMENTING');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCAN_COMPLETED', 'COMMENT_REPLY', 'COMMENT_MODERATED', 'RESOURCE_CREATED', 'RESOURCE_UPDATED', 'RESOURCE_DELETED', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "comment_banned_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_2fa" (
    "user_id" UUID NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_2fa_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_artifacts" (
    "artifact_id" UUID NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "sha1" VARCHAR(40),
    "md5" VARCHAR(32),
    "size" BIGINT NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,

    CONSTRAINT "file_artifacts_pkey" PRIMARY KEY ("artifact_id")
);

-- CreateTable
CREATE TABLE "url_artifacts" (
    "artifact_id" UUID NOT NULL,
    "normalized_url" TEXT NOT NULL,
    "url_hash" VARCHAR(64) NOT NULL,
    "domain" VARCHAR(255),

    CONSTRAINT "url_artifacts_pkey" PRIMARY KEY ("artifact_id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "user_id" UUID,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "source" "SubmissionSource" NOT NULL DEFAULT 'WEB',
    "original_filename" TEXT,
    "original_url" TEXT,
    "binary_delete_deadline" TIMESTAMP(3),
    "binary_deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "submission_id" UUID,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "reason" "ScanReason" NOT NULL DEFAULT 'INITIAL',
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "overall_verdict" "Verdict" NOT NULL DEFAULT 'UNKNOWN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "stale_at" TIMESTAMP(3),
    "error_message" TEXT,
    "provider" VARCHAR(100),
    "provider_analysis_id" VARCHAR(255),
    "provider_status" VARCHAR(100),
    "provider_checked_at" TIMESTAMP(3),

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_engines" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_engine_results" (
    "id" UUID NOT NULL,
    "scan_id" UUID NOT NULL,
    "engine_id" UUID NOT NULL,
    "verdict" "Verdict" NOT NULL DEFAULT 'UNKNOWN',
    "detection_name" TEXT,
    "engine_version" TEXT,
    "signature_version" TEXT,
    "response_time_ms" INTEGER,
    "raw_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_engine_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_id" UUID,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_votes" (
    "artifact_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_votes_pkey" PRIMARY KEY ("artifact_id","user_id")
);

-- CreateTable
CREATE TABLE "comment_reports" (
    "id" UUID NOT NULL,
    "comment_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" UUID NOT NULL,
    "moderator_id" UUID NOT NULL,
    "target_user_id" UUID,
    "comment_id" UUID,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "type" "NotificationType" NOT NULL,
    "artifact_id" UUID,
    "comment_id" UUID,
    "entity_type" VARCHAR(50),
    "entity_id" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key_prefix" VARCHAR(20) NOT NULL,
    "key_hash" TEXT NOT NULL,
    "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_request_logs" (
    "id" UUID NOT NULL,
    "api_key_id" UUID,
    "user_id" UUID,
    "artifact_id" UUID,
    "method" VARCHAR(10) NOT NULL,
    "route" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_usage_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "artifact_id" UUID,
    "scan_id" UUID,
    "provider" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "successful" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_last_seen_at_idx" ON "user_sessions"("user_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "artifacts_type_idx" ON "artifacts"("type");

-- CreateIndex
CREATE INDEX "artifacts_last_seen_at_idx" ON "artifacts"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "file_artifacts_sha256_key" ON "file_artifacts"("sha256");

-- CreateIndex
CREATE INDEX "file_artifacts_sha1_idx" ON "file_artifacts"("sha1");

-- CreateIndex
CREATE INDEX "file_artifacts_md5_idx" ON "file_artifacts"("md5");

-- CreateIndex
CREATE UNIQUE INDEX "url_artifacts_url_hash_key" ON "url_artifacts"("url_hash");

-- CreateIndex
CREATE INDEX "url_artifacts_domain_idx" ON "url_artifacts"("domain");

-- CreateIndex
CREATE INDEX "submissions_artifact_id_created_at_idx" ON "submissions"("artifact_id", "created_at");

-- CreateIndex
CREATE INDEX "submissions_user_id_created_at_idx" ON "submissions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "submissions_visibility_idx" ON "submissions"("visibility");

-- CreateIndex
CREATE INDEX "scans_artifact_id_created_at_idx" ON "scans"("artifact_id", "created_at");

-- CreateIndex
CREATE INDEX "scans_submission_id_idx" ON "scans"("submission_id");

-- CreateIndex
CREATE INDEX "scans_status_idx" ON "scans"("status");

-- CreateIndex
CREATE INDEX "scans_overall_verdict_idx" ON "scans"("overall_verdict");

-- CreateIndex
CREATE INDEX "scans_stale_at_idx" ON "scans"("stale_at");

-- CreateIndex
CREATE INDEX "scans_provider_provider_analysis_id_idx" ON "scans"("provider", "provider_analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_engines_name_key" ON "scan_engines"("name");

-- CreateIndex
CREATE INDEX "scan_engines_active_idx" ON "scan_engines"("active");

-- CreateIndex
CREATE INDEX "scan_engine_results_engine_id_idx" ON "scan_engine_results"("engine_id");

-- CreateIndex
CREATE INDEX "scan_engine_results_verdict_idx" ON "scan_engine_results"("verdict");

-- CreateIndex
CREATE UNIQUE INDEX "scan_engine_results_scan_id_engine_id_key" ON "scan_engine_results"("scan_id", "engine_id");

-- CreateIndex
CREATE INDEX "comments_artifact_id_created_at_idx" ON "comments"("artifact_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "comments_parent_id_idx" ON "comments"("parent_id");

-- CreateIndex
CREATE INDEX "comments_status_idx" ON "comments"("status");

-- CreateIndex
CREATE INDEX "community_votes_verdict_idx" ON "community_votes"("verdict");

-- CreateIndex
CREATE INDEX "comment_reports_status_created_at_idx" ON "comment_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "comment_reports_reviewed_by_id_idx" ON "comment_reports"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reports_comment_id_reporter_id_key" ON "comment_reports"("comment_id", "reporter_id");

-- CreateIndex
CREATE INDEX "moderation_actions_moderator_id_created_at_idx" ON "moderation_actions"("moderator_id", "created_at");

-- CreateIndex
CREATE INDEX "moderation_actions_target_user_id_idx" ON "moderation_actions"("target_user_id");

-- CreateIndex
CREATE INDEX "moderation_actions_comment_id_idx" ON "moderation_actions"("comment_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_artifact_id_idx" ON "notifications"("artifact_id");

-- CreateIndex
CREATE INDEX "notifications_comment_id_idx" ON "notifications"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_request_logs_api_key_id_created_at_idx" ON "api_request_logs"("api_key_id", "created_at");

-- CreateIndex
CREATE INDEX "api_request_logs_user_id_created_at_idx" ON "api_request_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "api_request_logs_route_created_at_idx" ON "api_request_logs"("route", "created_at");

-- CreateIndex
CREATE INDEX "llm_usage_logs_user_id_created_at_idx" ON "llm_usage_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_usage_logs_artifact_id_idx" ON "llm_usage_logs"("artifact_id");

-- CreateIndex
CREATE INDEX "llm_usage_logs_scan_id_idx" ON "llm_usage_logs"("scan_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "user_2fa" ADD CONSTRAINT "user_2fa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_artifacts" ADD CONSTRAINT "file_artifacts_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "url_artifacts" ADD CONSTRAINT "url_artifacts_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_engine_results" ADD CONSTRAINT "scan_engine_results_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_engine_results" ADD CONSTRAINT "scan_engine_results_engine_id_fkey" FOREIGN KEY ("engine_id") REFERENCES "scan_engines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_votes" ADD CONSTRAINT "community_votes_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_votes" ADD CONSTRAINT "community_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_usage_logs" ADD CONSTRAINT "llm_usage_logs_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
