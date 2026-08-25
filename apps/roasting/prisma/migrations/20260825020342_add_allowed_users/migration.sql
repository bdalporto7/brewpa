-- CreateTable
CREATE TABLE "AllowedUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedUser_email_key" ON "AllowedUser"("email");

-- Seed: migrate the emails that used to live in the ALLOWED_EMAILS env var.
INSERT INTO "AllowedUser" ("id", "email", "isAdmin") VALUES
  ('seed_brandondalport_yahoo', 'brandondalport@yahoo.com', true),
  ('seed_envynoodles_gmail', 'envynoodles@gmail.com', true),
  ('seed_kabhatia7_gmail', 'kabhatia7@gmail.com', false);
