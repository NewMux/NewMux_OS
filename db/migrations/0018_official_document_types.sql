-- Official Documents (PRD addendum 1.2): official letters and project
-- proposals become document types. Enum values have to be committed before
-- anything uses them, so they get a migration of their own (0019 uses them).
alter type document_type add value if not exists 'letter';
alter type document_type add value if not exists 'proposal';
