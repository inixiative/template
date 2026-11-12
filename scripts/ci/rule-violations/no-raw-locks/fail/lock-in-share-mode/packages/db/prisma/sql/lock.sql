-- FOR UPDATE in a comment is fine
SELECT * FROM job LOCK IN SHARE MODE;
