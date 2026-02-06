import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Pool } from 'pg';

const schema = `
-- Offices table (using gen_random_uuid() which is built-in to PostgreSQL 13+)
CREATE TABLE IF NOT EXISTS offices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entra_id VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    job_title VARCHAR(255),
    office_location VARCHAR(255),
    manager_name VARCHAR(255),
    manager_email VARCHAR(255),
    employee_type VARCHAR(100),
    account_enabled BOOLEAN DEFAULT true,
    photo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns if they don't exist (for existing databases)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'office_location') THEN
        ALTER TABLE users ADD COLUMN office_location VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'manager_name') THEN
        ALTER TABLE users ADD COLUMN manager_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'manager_email') THEN
        ALTER TABLE users ADD COLUMN manager_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'employee_type') THEN
        ALTER TABLE users ADD COLUMN employee_type VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'account_enabled') THEN
        ALTER TABLE users ADD COLUMN account_enabled BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Access events table
CREATE TABLE IF NOT EXISTS access_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('entry', 'exit')),
    source VARCHAR(50) NOT NULL CHECK (source IN ('unifi_access', 'ezradius')),
    device_info TEXT,
    raw_event_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Presence sessions table
CREATE TABLE IF NOT EXISTS presence_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily attendance aggregates
CREATE TABLE IF NOT EXISTS daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Hourly occupancy aggregates
CREATE TABLE IF NOT EXISTS hourly_occupancy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    average_occupancy INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(office_id, date, hour)
);

-- Sync status table
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL UNIQUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_event_timestamp TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_access_events_user_id ON access_events(user_id);
CREATE INDEX IF NOT EXISTS idx_access_events_office_id ON access_events(office_id);
CREATE INDEX IF NOT EXISTS idx_access_events_timestamp ON access_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_access_events_source ON access_events(source);
CREATE INDEX IF NOT EXISTS idx_presence_sessions_user_id ON presence_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_sessions_office_id ON presence_sessions(office_id);
CREATE INDEX IF NOT EXISTS idx_presence_sessions_entry_time ON presence_sessions(entry_time);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_office_date ON daily_attendance(office_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON daily_attendance(date);
CREATE INDEX IF NOT EXISTS idx_hourly_occupancy_office_date ON hourly_occupancy(office_id, date);
CREATE INDEX IF NOT EXISTS idx_users_entra_id ON users(entra_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert default offices
INSERT INTO offices (name, location, capacity, timezone) VALUES
('Dallas HQ', 'Dallas, TX', 150, 'America/Chicago'),
('Houston Office', 'Houston, TX', 80, 'America/Chicago'),
('Austin Office', 'Austin, TX', 60, 'America/Chicago'),
('San Antonio Office', 'San Antonio, TX', 45, 'America/Chicago'),
('Denver Office', 'Denver, CO', 55, 'America/Denver'),
('Phoenix Office', 'Phoenix, AZ', 40, 'America/Phoenix')
ON CONFLICT DO NOTHING;

-- Initialize sync status
INSERT INTO sync_status (source, status) VALUES ('unifi_access', 'pending'), ('ezradius', 'pending')
ON CONFLICT (source) DO NOTHING;
`;

export async function initDatabase(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Database initialization requested');
    
    // Auth check disabled for easier manual triggering
    // const authHeader = request.headers.get('x-init-key');
    // if (authHeader !== process.env.INIT_SECRET_KEY) {
    //     return { status: 401, body: 'Unauthorized' };
    // }

    const pool = new Pool({
        connectionString: process.env.POSTGRES_CONNECTION_STRING,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await pool.query(schema);
        context.log('Database schema initialized successfully');
        return {
            status: 200,
            jsonBody: { success: true, message: 'Database schema initialized successfully' }
        };
    } catch (error) {
        context.error('Database initialization failed:', error);
        return {
            status: 500,
            jsonBody: { success: false, error: String(error) }
        };
    } finally {
        await pool.end();
    }
}

app.http('initDatabase', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: initDatabase
});
