import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function getStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const currentOccupancy = await pool.query(`
      SELECT 
        COUNT(DISTINCT ps.user_id) as current_occupancy,
        SUM(o.capacity) as total_capacity
      FROM offices o
      LEFT JOIN presence_sessions ps ON o.id = ps.office_id 
        AND ps.exit_time IS NULL 
        AND ps.entry_time > CURRENT_TIMESTAMP - INTERVAL '12 hours'
      WHERE o.is_active = true
    `);

    const avgAttendance = await pool.query(`
      SELECT COALESCE(AVG(unique_visitors), 0) as avg_daily
      FROM daily_attendance
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    `);

    const avgDuration = await pool.query(`
      SELECT COALESCE(AVG(duration_minutes), 0) as avg_duration
      FROM presence_sessions
      WHERE entry_time >= CURRENT_DATE - INTERVAL '30 days'
        AND duration_minutes IS NOT NULL
    `);

    const weekChange = await pool.query(`
      WITH this_week AS (
        SELECT COALESCE(SUM(unique_visitors), 0) as total
        FROM daily_attendance
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      ),
      last_week AS (
        SELECT COALESCE(SUM(unique_visitors), 0) as total
        FROM daily_attendance
        WHERE date >= CURRENT_DATE - INTERVAL '14 days'
          AND date < CURRENT_DATE - INTERVAL '7 days'
      )
      SELECT 
        CASE WHEN last_week.total > 0 
          THEN ROUND(((this_week.total - last_week.total)::DECIMAL / last_week.total) * 100, 1)
          ELSE 0 
        END as change
      FROM this_week, last_week
    `);

    const activeOffices = await pool.query(`
      SELECT COUNT(*) as count FROM offices WHERE is_active = true
    `);

    return {
      status: 200,
      jsonBody: {
        currentOccupancy: parseInt(currentOccupancy.rows[0].current_occupancy) || 0,
        totalCapacity: parseInt(currentOccupancy.rows[0].total_capacity) || 0,
        averageDailyAttendance: Math.round(parseFloat(avgAttendance.rows[0].avg_daily) || 0),
        averageStayDuration: Math.round(parseFloat(avgDuration.rows[0].avg_duration) || 0),
        weekOverWeekChange: parseFloat(weekChange.rows[0].change) || 0,
        activeOffices: parseInt(activeOffices.rows[0].count) || 0,
      },
    };
  } catch (error) {
    context.error('Failed to get stats:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

async function getAttendance(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.query.get('officeId');
    const startDate = request.query.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = request.query.get('endDate') || new Date().toISOString().split('T')[0];

    let query = `
      SELECT da.*, o.name as office_name
      FROM daily_attendance da
      JOIN offices o ON da.office_id = o.id
      WHERE da.date >= $1 AND da.date <= $2
    `;
    const params: (string | null)[] = [startDate, endDate];

    if (officeId) {
      query += ' AND da.office_id = $3';
      params.push(officeId);
    }

    query += ' ORDER BY da.date, o.name';

    const result = await pool.query(query, params);

    return { status: 200, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get attendance:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

async function getHourlyOccupancy(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const officeId = request.query.get('officeId');

    let query = `
      SELECT 
        ho.hour,
        EXTRACT(DOW FROM ho.date) as day_of_week,
        AVG(ho.average_occupancy) as average_occupancy,
        ho.office_id
      FROM hourly_occupancy ho
      WHERE ho.date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const params: string[] = [];

    if (officeId) {
      query += ' AND ho.office_id = $1';
      params.push(officeId);
    }

    query += ' GROUP BY ho.hour, EXTRACT(DOW FROM ho.date), ho.office_id';

    const result = await pool.query(query, params);

    return { status: 200, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get hourly occupancy:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

async function getOffices(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const result = await pool.query(`
      SELECT o.*, co.current_occupancy, co.occupancy_rate
      FROM offices o
      LEFT JOIN current_occupancy co ON o.id = co.office_id
      WHERE o.is_active = true
      ORDER BY o.name
    `);

    return { status: 200, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get offices:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
  }
}

async function getUserPresence(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const result = await pool.query(`
      SELECT * FROM user_presence_summary
      ORDER BY total_visits DESC
      LIMIT 100
    `);

    return { status: 200, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get user presence:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
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
      jsonBody: {
        users: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      }
    };
  } catch (error) {
    context.error('Failed to get users:', error);
    return { status: 500, jsonBody: { error: 'Internal server error' } };
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
