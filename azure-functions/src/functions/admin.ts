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

async function getAllOffices(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const result = await pool.query(`
      SELECT id, name, location, capacity, timezone, is_active
      FROM offices
      ORDER BY name
    `);

    return { status: 200, headers: corsHeaders, jsonBody: result.rows };
  } catch (error) {
    context.error('Failed to get all offices:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function updateOffice(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders };
  }
  try {
    const officeId = request.params.officeId;
    const body = await request.json() as { name?: string; location?: string; capacity?: number; timezone?: string; is_active?: boolean };
    
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }
    if (body.location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(body.location);
    }
    if (body.capacity !== undefined) {
      updates.push(`capacity = $${paramIndex++}`);
      values.push(body.capacity);
    }
    if (body.timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(body.timezone);
    }
    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(body.is_active);
    }

    if (updates.length === 0) {
      return { status: 400, headers: corsHeaders, jsonBody: { error: 'No fields to update' } };
    }

    values.push(officeId);
    await pool.query(`UPDATE offices SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
    
    return { status: 200, headers: corsHeaders, jsonBody: { message: 'Office updated' } };
  } catch (error) {
    context.error('Failed to update office:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

async function createOffice(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = await request.json() as { name: string; location: string; capacity?: number; timezone?: string };
    
    if (!body.name || !body.location) {
      return { status: 400, headers: corsHeaders, jsonBody: { error: 'Name and location required' } };
    }

    const result = await pool.query(`
      INSERT INTO offices (name, location, capacity, timezone, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id
    `, [body.name, body.location, body.capacity || 50, body.timezone || 'America/Chicago']);
    
    return { status: 201, headers: corsHeaders, jsonBody: { id: result.rows[0].id, message: 'Office created' } };
  } catch (error) {
    context.error('Failed to create office:', error);
    return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal server error' } };
  }
}

app.http('adminGetAllOffices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/offices',
  handler: getAllOffices,
});

app.http('adminUpdateOffice', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/office/{officeId}',
  handler: updateOffice,
});

app.http('adminCreateOffice', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/offices',
  handler: createOffice,
});
