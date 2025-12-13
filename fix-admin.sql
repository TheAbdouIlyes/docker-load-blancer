DELETE FROM admins WHERE username='admin';
INSERT INTO admins (username, password, email) VALUES ('admin', '$2b$10$qt1v9dlVNQewX5oQSUhz6uJECv4kI7rrO7yS2B1FJrEx.hslTUX9q', 'admin@voting.local');
SELECT id, username, password FROM admins;
