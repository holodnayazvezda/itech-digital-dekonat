"""SQLCipher schema used by non-destructive initialization."""

SCHEMA = """
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,owner TEXT,kind TEXT,body TEXT);
CREATE TABLE IF NOT EXISTS request_submissions(
    owner TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
    record_id TEXT NOT NULL REFERENCES records(id), PRIMARY KEY(owner,request_id)
);
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,owner TEXT,title TEXT,body TEXT,priority INTEGER,ref TEXT,created INTEGER);
CREATE TABLE IF NOT EXISTS inbox_cleared(owner TEXT PRIMARY KEY,through_id INTEGER NOT NULL);
CREATE VIEW IF NOT EXISTS inbox_notes AS
SELECT n.* FROM notes n LEFT JOIN inbox_cleared c ON c.owner=n.owner
WHERE n.id > COALESCE(c.through_id, 0);
CREATE TABLE IF NOT EXISTS note_reads(note_id INTEGER PRIMARY KEY REFERENCES notes(id));
CREATE TABLE IF NOT EXISTS avatars(owner TEXT PRIMARY KEY,data TEXT);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,sender TEXT NOT NULL,recipient TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS group_dispatches(
    sender TEXT NOT NULL, request_id TEXT NOT NULL, group_code TEXT NOT NULL,
    body TEXT NOT NULL, recipients INTEGER NOT NULL, PRIMARY KEY(sender, request_id)
);
CREATE INDEX IF NOT EXISTS messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS messages_recipient ON messages(recipient);
CREATE TABLE IF NOT EXISTS lesson_overrides(
    lesson_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, original TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_actions(
    actor TEXT NOT NULL, request_id TEXT NOT NULL, payload TEXT NOT NULL,
    response TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(actor, request_id)
);
CREATE TABLE IF NOT EXISTS attachments(record_id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,content BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS demo_wifi(owner TEXT PRIMARY KEY,ciphertext BLOB NOT NULL,ready INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS elective_selections(owner TEXT PRIMARY KEY,course TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_keys(id INTEGER PRIMARY KEY,value TEXT);
CREATE TABLE IF NOT EXISTS subscriptions(endpoint TEXT NOT NULL,owner TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(endpoint,owner));
CREATE INDEX IF NOT EXISTS notes_owner_id ON notes(owner,id);
CREATE TABLE IF NOT EXISTS settings(name TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS revoked(jti TEXT PRIMARY KEY, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS office_tasks(
    id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
    due TEXT, request_id TEXT REFERENCES records(id), complete INTEGER NOT NULL DEFAULT 0,
    created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS irishka_chats(
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL,
    created INTEGER NOT NULL, updated INTEGER NOT NULL,
    title_custom INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS irishka_chats_owner ON irishka_chats(owner,updated);
CREATE TABLE IF NOT EXISTS irishka_turns(id TEXT NOT NULL,chat_id TEXT NOT NULL,body TEXT NOT NULL,reply TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(chat_id,id));
"""
