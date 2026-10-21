-- One row per browser that finishes the deck; a retake replaces that browser's earlier answers.
CREATE TABLE IF NOT EXISTS results (
  cid        TEXT PRIMARY KEY,           -- random id the browser makes once; not tied to a person
  code       TEXT NOT NULL,              -- all 50 verdicts, 2 bits each, base64url (same as #r= links)
  pct        INTEGER NOT NULL,           -- agreement with MI, 0-100
  likes      INTEGER NOT NULL,
  supers     INTEGER NOT NULL,
  nopes      INTEGER NOT NULL,
  is_test    INTEGER NOT NULL DEFAULT 0, -- local-dev and flagged test runs; left out of /stats
  submits    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS results_live ON results (is_test, updated_at);
