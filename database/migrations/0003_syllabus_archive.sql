-- Campusly · 0003 · Syllabus books and chapters can be archived (history kept)
ALTER TABLE "books" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "archived_at" timestamp with time zone;