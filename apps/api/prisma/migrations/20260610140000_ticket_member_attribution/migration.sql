-- Reserved membership attribution snapshot on each ticket (design.md §2.6).
-- Opaque, platform-agnostic member id captured at a lifecycle moment.
-- Reserved only: no application code reads/writes these in the PoC.
ALTER TABLE "Ticket" ADD COLUMN "memberId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "memberBoundAt" DATETIME;
