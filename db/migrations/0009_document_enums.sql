-- New document states and the credit-note type (Improvements PRD items 9, 10, 37).
-- Kept in their own migration: Postgres can't use an enum value in the same
-- transaction that adds it.
alter type document_status add value if not exists 'void';
alter type document_status add value if not exists 'declined';
alter type document_type add value if not exists 'credit_note';
