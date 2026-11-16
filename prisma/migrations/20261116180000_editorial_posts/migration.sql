-- Editorial posts are independent of payments and user sessions.
CREATE TABLE "ContentPost" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(110) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "excerpt" VARCHAR(350) NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "tags" VARCHAR(350) NOT NULL DEFAULT '',
  "body" TEXT NOT NULL,
  "imageData" BYTEA,
  "imageMime" VARCHAR(32),
  "imageAlt" VARCHAR(180),
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMPTZ(3),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "authorId" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentPost_status_check" CHECK ("status" IN ('DRAFT','PUBLISHED','ARCHIVED')),
  CONSTRAINT "ContentPost_category_check" CHECK ("category" IN ('Notícias','Patch Notes','Avisos')),
  CONSTRAINT "ContentPost_published_required_check" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL),
  CONSTRAINT "ContentPost_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "ContentPost_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "ContentPost_body_length_check" CHECK (char_length("body") BETWEEN 1 AND 20000),
  CONSTRAINT "ContentPost_image_size_check" CHECK ("imageData" IS NULL OR octet_length("imageData") <= 750000),
  CONSTRAINT "ContentPost_image_consistency_check" CHECK (("imageData" IS NULL AND "imageMime" IS NULL AND "imageAlt" IS NULL) OR ("imageData" IS NOT NULL AND "imageMime" IN ('image/webp','image/jpeg','image/png') AND char_length("imageAlt") BETWEEN 5 AND 180))
);
CREATE UNIQUE INDEX "ContentPost_slug_key" ON "ContentPost"("slug");
CREATE INDEX "ContentPost_status_publishedAt_idx" ON "ContentPost"("status", "publishedAt");
CREATE INDEX "ContentPost_createdAt_idx" ON "ContentPost"("createdAt");
CREATE INDEX "ContentPost_authorId_idx" ON "ContentPost"("authorId");
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
