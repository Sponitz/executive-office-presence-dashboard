-- Office Presence Dashboard - PostgreSQL Schema
-- Run this script to create the database schema in Azure Database for PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Offices table
CREATE TABLE offices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Chicago',
    unifi_site_id VARCHAR(100),
    ezradius_location_id VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table (synced from Entra ID)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entra_id VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    job_title VARCHAR(255),
    photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Access events table (raw events from UniFi Access and EZRADIUS)
CREATE TABLE access_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('entry', 'exit')),
    source VARCHAR(50) NOT NULL CHECK (source IN ('unifi_access', 'ezradius')),
    device_info TEXT,
    raw_event_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Presence sessions table (computed from access events)
CREATE TABLE presence_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily attendance aggregates (pre-computed for performance)
CREATE TABLE daily_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    unique_visitors INTEGER NOT NULL DEFAULT 0,
    total_entries INTEGER NOT NULL DEFAULT 0,
    average_duration_minutes INTEGER NOT NULL DEFAULT 0,
    peak_occupancy INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(office_id, date)
);

-- Hourly occupancy aggregates (for heatmap)
CREATE TABLE hourly_occupancy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    average_occupancy INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(office_id, date, hour)
);

-- Sync status table (track API sync state)
CREATE TABLE sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_event_timestamp TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_access_events_user_id ON access_events(user_id);
CREATE INDEX idx_access_events_office_id ON access_events(office_id);
CREATE INDEX idx_access_events_timestamp ON access_events(timestamp);
CREATE INDEX idx_access_events_source ON access_events(source);

CREATE INDEX idx_presence_sessions_user_id ON presence_sessions(user_id);
CREATE INDEX idx_presence_sessions_office_id ON presence_sessions(office_id);
CREATE INDEX idx_presence_sessions_entry_time ON presence_sessions(entry_time);

CREATE INDEX idx_daily_attendance_office_date ON daily_attendance(office_id, date);
CREATE INDEX idx_daily_attendance_date ON daily_attendance(date);

CREATE INDEX idx_hourly_occupancy_office_date ON hourly_occupancy(office_id, date);

CREATE INDEX idx_users_entra_id ON users(entra_id);
CREATE INDEX idx_users_email ON users(email);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_offices_updated_at
    BEFORE UPDATE ON offices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presence_sessions_updated_at
    BEFORE UPDATE ON presence_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_attendance_updated_at
    BEFORE UPDATE ON daily_attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at
    BEFORE UPDATE ON sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View for user presence summary
CREATE VIEW user_presence_summary AS
SELECT 
    u.id as user_id,
    u.display_name,
    u.email,
    u.department,
    COUNT(DISTINCT ps.id) as total_visits,
    COALESCE(SUM(ps.duration_minutes), 0) as total_minutes,
    COALESCE(AVG(ps.duration_minutes), 0) as average_minutes_per_visit,
    MAX(ps.entry_time) as last_visit,
    (
        SELECT o.name 
        FROM presence_sessions ps2 
        JOIN offices o ON ps2.office_id = o.id 
        WHERE ps2.user_id = u.id 
        GROUP BY o.id, o.name 
        ORDER BY COUNT(*) DESC 
        LIMIT 1
    ) as primary_office
FROM users u
LEFT JOIN presence_sessions ps ON u.id = ps.user_id
WHERE u.is_active = true
GROUP BY u.id, u.display_name, u.email, u.department;

-- View for current occupancy
CREATE VIEW current_occupancy AS
SELECT 
    o.id as office_id,
    o.name as office_name,
    o.capacity,
    COUNT(DISTINCT ps.user_id) as current_occupancy,
    ROUND((COUNT(DISTINCT ps.user_id)::DECIMAL / NULLIF(o.capacity, 0)) * 100, 1) as occupancy_rate
FROM offices o
LEFT JOIN presence_sessions ps ON o.id = ps.office_id 
    AND ps.exit_time IS NULL 
    AND ps.entry_time > CURRENT_TIMESTAMP - INTERVAL '12 hours'
WHERE o.is_active = true
GROUP BY o.id, o.name, o.capacity;

-- Sample data for offices (uncomment to insert)
-- INSERT INTO offices (name, location, capacity, timezone) VALUES
-- ('Dallas HQ', 'Dallas, TX', 150, 'America/Chicago'),
-- ('Houston Office', 'Houston, TX', 80, 'America/Chicago'),
-- ('Austin Office', 'Austin, TX', 60, 'America/Chicago'),
-- ('San Antonio Office', 'San Antonio, TX', 45, 'America/Chicago'),
-- ('Denver Office', 'Denver, CO', 55, 'America/Denver'),
-- ('Phoenix Office', 'Phoenix, AZ', 40, 'America/Phoenix');
