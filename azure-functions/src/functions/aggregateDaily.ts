import { app, InvocationContext, Timer } from '@azure/functions';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function aggregateDaily(myTimer: Timer, context: InvocationContext): Promise<void> {
  context.log('Daily aggregation started');

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const officesResult = await pool.query('SELECT id FROM offices WHERE is_active = true');
    const offices = officesResult.rows;

    for (const office of offices) {
      const statsResult = await pool.query(
        `SELECT 
          COUNT(DISTINCT user_id) as unique_visitors,
          COUNT(*) as total_entries,
          COALESCE(AVG(ps.duration_minutes), 0) as average_duration_minutes
        FROM presence_sessions ps
        WHERE ps.office_id = $1 
          AND DATE(ps.entry_time) = $2`,
        [office.id, dateStr]
      );

      const peakResult = await pool.query(
        `WITH hourly_counts AS (
          SELECT 
            EXTRACT(HOUR FROM entry_time) as hour,
            COUNT(DISTINCT user_id) as occupancy
          FROM presence_sessions
          WHERE office_id = $1 
            AND DATE(entry_time) = $2
          GROUP BY EXTRACT(HOUR FROM entry_time)
        )
        SELECT COALESCE(MAX(occupancy), 0) as peak_occupancy FROM hourly_counts`,
        [office.id, dateStr]
      );

      const stats = statsResult.rows[0];
      const peak = peakResult.rows[0];

      await pool.query(
        `INSERT INTO daily_attendance (office_id, date, unique_visitors, total_entries, average_duration_minutes, peak_occupancy)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (office_id, date) DO UPDATE SET
           unique_visitors = EXCLUDED.unique_visitors,
           total_entries = EXCLUDED.total_entries,
           average_duration_minutes = EXCLUDED.average_duration_minutes,
           peak_occupancy = EXCLUDED.peak_occupancy,
           updated_at = CURRENT_TIMESTAMP`,
        [
          office.id,
          dateStr,
          stats.unique_visitors || 0,
          stats.total_entries || 0,
          Math.round(stats.average_duration_minutes || 0),
          peak.peak_occupancy || 0,
        ]
      );

      for (let hour = 0; hour < 24; hour++) {
        const hourlyResult = await pool.query(
          `SELECT COUNT(DISTINCT user_id) as occupancy
           FROM presence_sessions
           WHERE office_id = $1 
             AND DATE(entry_time) = $2
             AND EXTRACT(HOUR FROM entry_time) <= $3
             AND (exit_time IS NULL OR EXTRACT(HOUR FROM exit_time) >= $3)`,
          [office.id, dateStr, hour]
        );

        await pool.query(
          `INSERT INTO hourly_occupancy (office_id, date, hour, average_occupancy)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (office_id, date, hour) DO UPDATE SET
             average_occupancy = EXCLUDED.average_occupancy`,
          [office.id, dateStr, hour, hourlyResult.rows[0].occupancy || 0]
        );
      }

      context.log(`Aggregated data for office ${office.id} on ${dateStr}`);
    }

    context.log('Daily aggregation completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error(`Daily aggregation failed: ${errorMessage}`);
    throw error;
  }
}

app.timer('aggregateDaily', {
  schedule: '0 0 2 * * *',
  handler: aggregateDaily,
});
