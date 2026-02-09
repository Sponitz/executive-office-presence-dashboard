import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-init-key',
};

async function getStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Get total capacity from active offices
    const capacityResult = await pool.query(`
      SELECT COALESCE(SUM(capacity), 0) as total_capacity, COUNT(*) as office_count
      FROM offices WHERE is_active = true
    `);

    // Count unique users who badged in today (current day visitors)
    const todayVisitors = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as today_visitors
      FROM access_events
      WHERE DATE(timestamp) = CURRENT_DATE
    `);

    // Average daily attendance from access_events (unique users per day, last 30 days)
    const avgAttendance = await pool.query(`
      SELECT COALESCE(AVG(daily_count), 0) as avg_daily
      FROM (
        SELECT DATE(timestamp) as day, COUNT(DISTINCT user_id) as daily_count
        FROM access_events
        WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(timestamp)
      ) daily_stats
    `);

    // Week over week change based on access_events
    const weekChange = await pool.query(`
      WITH this_week AS (
        SELECT COUNT(DISTINCT user_id::text || DATE(timestamp)::text) as total
        FROM access_events
        WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
      ),
      last_week AS (
        SELECT COUNT(DISTINCT user_id::text || DATE(timestamp)::text) as total
        FROM access_events
        WHERE timestamp >= CURRENT_DATE - INTERVAL '14 days'
          AND timestamp < CURRENT_DATE - INTERVAL '7 days'
      )
      SELECT 
        CASE WHEN last_week.total > 0 
          THEN ROUND(((this_week.total - last_week.total)::DECIMAL / last_week.total) * 100, 1)
          ELSE 0 
        END as change
      FROM this_week, last_week
    `);

    return {
      status: 200,
      headers: corsHeaders,
      jsonBody: {
        currentOccupancy: parseInt(todayVisitors.rows[0].today_visitors) || 0,
        totalCapacity: parseInt(capacityResult.rows[0].total_capacity) || 0,
        averageDailyAttendance: Math.round(parseFloat(avgAttendance.rows[0].avg_daily) || 0),
        averageStayDuration: 0,
        weekOverWeekChange: parseFloat(weekChange.rows[0].change) || 0,
        activeOffices: parseInt(capacityResult.rows[0].office_count) || 0,
      },
    };
  } catch (error) {
    context.error('Failed to get stats:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getAttendance(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.query.get('officeId');
    const startDate = request.query.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = request.query.get('endDate') || new Date().toISOString().split('T')[0];

    let query = `
      SELECT 
        DATE(ae.timestamp)::text as date,
        ae.office_id as "officeId",
        o.name as office_name,
        COUNT(DISTINCT ae.user_id) as "uniqueVisitors",
        COUNT(*) as "totalEntries",
        0 as "averageDurationMinutes",
        COUNT(DISTINCT ae.user_id) as "peakOccupancy"
      FROM access_events ae
      JOIN offices o ON ae.office_id = o.id
      WHERE DATE(ae.timestamp) >= $1::date AND DATE(ae.timestamp) <= $2::date
    `;
    const params: (string | null)[] = [startDate, endDate];

    if (officeId) {
      query += ' AND ae.office_id = $3';
      params.push(officeId);
    }

    query += ' GROUP BY DATE(ae.timestamp), ae.office_id, o.name ORDER BY date, o.name';

    const result = await pool.query(query, params);

    return { status: 200, headers: corsHeaders, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get attendance:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getHourlyOccupancy(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.query.get('officeId');

    // Calculate peak hours from access_events
    let query = `
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        EXTRACT(DOW FROM timestamp) as day_of_week,
        COUNT(DISTINCT user_id) as average_occupancy,
        office_id
      FROM access_events
      WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const params: string[] = [];

    if (officeId) {
      query += ' AND office_id = $1';
      params.push(officeId);
    }

    query += ' GROUP BY EXTRACT(HOUR FROM timestamp), EXTRACT(DOW FROM timestamp), office_id';

    const result = await pool.query(query, params);

    return { status: 200, headers: corsHeaders, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get hourly occupancy:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getOffices(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const result = await pool.query(`
      SELECT id, name, location, capacity, timezone, is_active
      FROM offices
      WHERE is_active = true
      ORDER BY name
    `);

    return { status: 200, headers: corsHeaders, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get offices:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getUserPresence(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Get top visitors based on unique days visited from access_events
    const result = await pool.query(`
      SELECT 
        u.id as "userId",
        u.email,
        u.display_name as "displayName",
        COUNT(DISTINCT DATE(ae.timestamp)) as "totalVisits",
        0 as "totalMinutes",
        0 as "averageMinutesPerVisit",
        MAX(ae.timestamp) as "lastVisit",
        (
          SELECT o.name FROM access_events ae2
          JOIN offices o ON ae2.office_id = o.id
          WHERE ae2.user_id = u.id
          GROUP BY o.name
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as "primaryOffice"
      FROM users u
      JOIN access_events ae ON u.id = ae.user_id
      WHERE ae.timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.email, u.display_name
      ORDER BY "totalVisits" DESC
      LIMIT 100
    `);

    return { status: 200, headers: corsHeaders, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get user presence:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getUsers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const limit = parseInt(request.query.get('limit') || '100');
    const offset = parseInt(request.query.get('offset') || '0');
    const search = request.query.get('search');

    let query = `
      SELECT id, entra_id, email, display_name, department, job_title, created_at
      FROM users
    `;
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` WHERE display_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR department ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY display_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');

    return { 
      status: 200, 
      headers: corsHeaders,
      jsonBody: {
        users: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      }
    };
  } catch (error) {
    context.error('Failed to get users:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('getStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'stats',
  handler: getStats,
});

app.http('getAttendance', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'attendance',
  handler: getAttendance,
});

app.http('getHourlyOccupancy', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'hourly-occupancy',
  handler: getHourlyOccupancy,
});

app.http('getOffices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'offices',
  handler: getOffices,
});

app.http('getUserPresence', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'user-presence',
  handler: getUserPresence,
});

app.http('getUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users',
  handler: getUsers,
});

async function getUserById(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.params.userId;
    if (!userId) {
      return { status: 400, headers: corsHeaders, jsonBody: { error: 'User ID required' } };
    }

    // Include all extended profile columns
    const result = await pool.query(`
      SELECT id, entra_id, email, display_name, department, job_title, 
             office_location, manager_name, manager_email, employee_type, 
             account_enabled, created_at
      FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return { status: 404, headers: corsHeaders, jsonBody: { error: 'User not found' } };
    }

    return { status: 200, headers: corsHeaders, jsonBody: result.rows[0] };
  } catch (error) {
    context.error('Failed to get user:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getUserSessions(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.params.userId;
    const limit = parseInt(request.query.get('limit') || '50');

    // Return access events (door unlocks) instead of sessions for more accurate data
    const result = await pool.query(`
      SELECT ae.id, o.name as office_name, ae.timestamp as entry_time, 
             ae.device_info as door_name, ae.event_type
      FROM access_events ae
      JOIN offices o ON ae.office_id = o.id
      WHERE ae.user_id = $1
      ORDER BY ae.timestamp DESC
      LIMIT $2
    `, [userId, limit]);

    return { status: 200, headers: corsHeaders, jsonBody: { sessions: result.rows } };
  } catch (error) {
    context.error('Failed to get user sessions:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getUserStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = request.params.userId;

    // Count access events (door unlocks) instead of sessions for accurate visit count
    const accessEvents = await pool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT DATE(timestamp)) as unique_days,
        MAX(timestamp) as last_visit
      FROM access_events
      WHERE user_id = $1
    `, [userId]);

    // Also get session-based stats for duration info
    const sessionStats = await pool.query(`
      SELECT 
        COALESCE(SUM(duration_minutes) / 60.0, 0) as total_hours,
        COALESCE(AVG(duration_minutes), 0) as avg_duration_minutes
      FROM presence_sessions
      WHERE user_id = $1 AND duration_minutes IS NOT NULL
    `, [userId]);

    const mostVisited = await pool.query(`
      SELECT o.name, COUNT(*) as visit_count
      FROM access_events ae
      JOIN offices o ON ae.office_id = o.id
      WHERE ae.user_id = $1
      GROUP BY o.name
      ORDER BY visit_count DESC
      LIMIT 1
    `, [userId]);

    return { 
      status: 200, 
      headers: corsHeaders, 
      jsonBody: {
        total_visits: parseInt(accessEvents.rows[0].unique_days) || 0,
        total_access_events: parseInt(accessEvents.rows[0].total_events) || 0,
        total_hours: parseFloat(sessionStats.rows[0].total_hours) || 0,
        avg_duration_minutes: Math.round(parseFloat(sessionStats.rows[0].avg_duration_minutes) || 0),
        last_visit: accessEvents.rows[0].last_visit,
        most_visited_office: mostVisited.rows[0]?.name || null,
      }
    };
  } catch (error) {
    context.error('Failed to get user stats:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getOfficeById(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.params.officeId;
    if (!officeId) {
      return { status: 400, headers: corsHeaders, jsonBody: { error: 'Office ID required' } };
    }

    const result = await pool.query(`
      SELECT id, name, location, capacity, timezone, is_active
      FROM offices WHERE id = $1
    `, [officeId]);

    if (result.rows.length === 0) {
      return { status: 404, headers: corsHeaders, jsonBody: { error: 'Office not found' } };
    }

    return { status: 200, headers: corsHeaders, jsonBody: result.rows[0] };
  } catch (error) {
    context.error('Failed to get office:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getOfficeDailyStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.params.officeId;
    const days = parseInt(request.query.get('days') || '30');

    const result = await pool.query(`
      SELECT 
        DATE(timestamp)::text as date,
        COUNT(DISTINCT user_id) as unique_visitors,
        COUNT(*) as total_entries,
        0 as avg_duration_minutes,
        COUNT(DISTINCT user_id) as peak_occupancy
      FROM access_events
      WHERE office_id = $1 AND timestamp >= CURRENT_DATE - INTERVAL '1 day' * $2
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `, [officeId, days]);

    return { status: 200, headers: corsHeaders, jsonBody: { stats: result.rows } };
  } catch (error) {
    context.error('Failed to get office daily stats:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getOfficeHourlyStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.params.officeId;

    const result = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM timestamp)::int as hour,
        COUNT(DISTINCT user_id) as avg_occupancy
      FROM access_events
      WHERE office_id = $1 AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY EXTRACT(HOUR FROM timestamp)
      ORDER BY hour
    `, [officeId]);

    return { status: 200, headers: corsHeaders, jsonBody: { stats: result.rows } };
  } catch (error) {
    context.error('Failed to get office hourly stats:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getOfficeTopVisitors(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.params.officeId;
    const limit = parseInt(request.query.get('limit') || '10');

    const result = await pool.query(`
      SELECT u.id as user_id, u.display_name, u.email,
             COUNT(DISTINCT DATE(ae.timestamp)) as visit_count,
             0 as total_hours
      FROM access_events ae
      JOIN users u ON ae.user_id = u.id
      WHERE ae.office_id = $1 AND ae.timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY u.id, u.display_name, u.email
      ORDER BY visit_count DESC
      LIMIT $2
    `, [officeId, limit]);

    return { status: 200, headers: corsHeaders, jsonBody: { visitors: result.rows } };
  } catch (error) {
    context.error('Failed to get office top visitors:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function getOfficeOccupancy(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.params.officeId;

    const result = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as current
      FROM presence_sessions
      WHERE office_id = $1 AND exit_time IS NULL 
        AND entry_time > CURRENT_TIMESTAMP - INTERVAL '12 hours'
    `, [officeId]);

    return { status: 200, headers: corsHeaders, jsonBody: { current: parseInt(result.rows[0].current) || 0 } };
  } catch (error) {
    context.error('Failed to get office occupancy:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('getUserById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'user/{userId}',
  handler: getUserById,
});

app.http('getUserSessions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'user/{userId}/sessions',
  handler: getUserSessions,
});

app.http('getUserStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'user/{userId}/stats',
  handler: getUserStats,
});

app.http('getOfficeById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'office/{officeId}',
  handler: getOfficeById,
});

app.http('getOfficeDailyStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'office/{officeId}/daily',
  handler: getOfficeDailyStats,
});

app.http('getOfficeHourlyStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'office/{officeId}/hourly',
  handler: getOfficeHourlyStats,
});

app.http('getOfficeTopVisitors', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'office/{officeId}/top-visitors',
  handler: getOfficeTopVisitors,
});

app.http('getOfficeOccupancy', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'office/{officeId}/occupancy',
  handler: getOfficeOccupancy,
});

// Admin endpoint to deactivate an office
async function deactivateOffice(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.params.officeId;
    if (!officeId) {
      return { status: 400, headers: corsHeaders, jsonBody: { error: 'Office ID required' } };
    }

    await pool.query('UPDATE offices SET is_active = false WHERE id = $1', [officeId]);
    return { status: 200, headers: corsHeaders, jsonBody: { message: 'Office deactivated' } };
  } catch (error) {
    context.error('Failed to deactivate office:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('deactivateOffice', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'office/{officeId}',
  handler: deactivateOffice,
});

// Weekly attendance trends endpoint
async function getWeeklyTrends(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const result = await pool.query(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as unique_visitors
      FROM access_events
      WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(timestamp)
      ORDER BY date
    `);

    return { status: 200, headers: corsHeaders, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get weekly trends:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('getWeeklyTrends', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'weekly-trends',
  handler: getWeeklyTrends,
});
