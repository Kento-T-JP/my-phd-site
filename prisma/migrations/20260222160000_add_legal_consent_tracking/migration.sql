-- Track legal consent for registration and admin audit.
ALTER TABLE "User"
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "legalVersionAccepted" TEXT;

ALTER TABLE "PendingRegistration"
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN "legalVersionAccepted" TEXT NOT NULL DEFAULT '2026-02-22';
