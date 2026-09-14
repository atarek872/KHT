ALTER TABLE welcome_campaign_settings
ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'home' CHECK (display_mode IN ('home', 'path'));

ALTER TABLE welcome_campaign_settings
ADD COLUMN display_path TEXT NOT NULL DEFAULT '/';
