import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Pool } from 'pg';

const offices = [
  // USA
  { name: 'Dallas HQ', location: 'Plano, TX', address: '5445 Legacy Drive, Suite 100, Plano, Texas 75024', phone: '+1 (214) 613-4444', timezone: 'America/Chicago', capacity: 150, country: 'USA' },
  { name: 'Atlanta', location: 'Alpharetta, GA', address: '11675 Rainwater Drive, Suite 100, Alpharetta, Georgia 30009', phone: '+1 (770) 623-5734', timezone: 'America/New_York', capacity: 80, country: 'USA' },
  { name: 'Austin', location: 'Austin, TX', address: '11044 Research Blvd, Suite C-120, Austin, Texas 78759', phone: '+1 (512) 551-2773', timezone: 'America/Chicago', capacity: 60, country: 'USA' },
  { name: 'Chicago', location: 'Chicago, IL', address: '222 S. Riverside, 15th Floor, Chicago, Illinois 60606', phone: '+1 (312) 491-3000', timezone: 'America/Chicago', capacity: 70, country: 'USA' },
  { name: 'Cleveland', location: 'Independence, OH', address: '6000 Freedom Square Dr, Ste 110, Independence, Ohio 44131', phone: '+1 (866) 549-0279', timezone: 'America/New_York', capacity: 50, country: 'USA' },
  { name: 'Columbus', location: 'Columbus, OH', address: '330 Rush Alley, Suite 150, Columbus, Ohio 43215', phone: '+1 (380) 799-5431', timezone: 'America/New_York', capacity: 50, country: 'USA' },
  { name: 'Houston', location: 'Houston, TX', address: '10111 Richmond Ave, Suite 100, Houston, Texas 77042', phone: '+1 (832) 699-7521', timezone: 'America/Chicago', capacity: 80, country: 'USA' },
  { name: 'Minneapolis', location: 'Minneapolis, MN', address: '3033 Excelsior Boulevard, Suite 180, Minneapolis, Minnesota 55416', phone: '+1 (612) 746-1580', timezone: 'America/Chicago', capacity: 60, country: 'USA' },
  { name: 'Omaha', location: 'Omaha, NE', address: '18881 West Dodge Road, Suite 120E, Omaha, Nebraska 68022', phone: '+1 (402) 513-0484', timezone: 'America/Chicago', capacity: 40, country: 'USA' },
  // Canada
  { name: 'Calgary', location: 'Calgary, AB', address: '2535-3rd Ave SE, Suite 102, Calgary, Alberta T2A 7W5', phone: '+1 (403) 257-0850', timezone: 'America/Edmonton', capacity: 50, country: 'Canada' },
  { name: 'Ottawa', location: 'Ottawa, ON', address: '411 Legget Drive, Suite 710, Ottawa, Ontario K2K 3C9', phone: '+1 (888) 322-6002', timezone: 'America/Toronto', capacity: 50, country: 'Canada' },
  { name: 'Vancouver', location: 'Vancouver, BC', address: '116 W 6th Avenue, Suite 300, Vancouver, B.C. V5Y 1K6', phone: '+1 (778) 331-3355', timezone: 'America/Vancouver', capacity: 50, country: 'Canada' },
  { name: 'Toronto', location: 'Toronto, ON', address: '171 East Liberty St, Unit 235, Toronto, Ontario M6K 3P6', phone: '+1 (437) 222-9332', timezone: 'America/Toronto', capacity: 60, country: 'Canada' },
  { name: 'Winnipeg', location: 'Winnipeg, MB', address: '233 Portage Avenue, Suite 210, Winnipeg, Manitoba R3B 2A7', phone: '+1 (204) 989-6022', timezone: 'America/Winnipeg', capacity: 40, country: 'Canada' },
  // Mexico
  { name: 'Aguascalientes', location: 'Aguascalientes, MX', address: 'Ciencia y Tecnología 106, Pocitos, Aguascalientes, Ags 20328', phone: '+52 (449) 922-7827', timezone: 'America/Mexico_City', capacity: 40, country: 'Mexico' },
  { name: 'Guadalajara', location: 'Guadalajara, MX', address: 'Av. Patria 888, Loma Real, Guadalajara, Jalisco 45129', phone: '+52 33 4738 0200', timezone: 'America/Mexico_City', capacity: 50, country: 'Mexico' },
  // South America
  { name: 'Buenos Aires', location: 'Buenos Aires, AR', address: 'Av. Luis María Campos 877, BOG, Buenos Aires, Argentina C1426', phone: '+54 9 11 27623538', timezone: 'America/Argentina/Buenos_Aires', capacity: 40, country: 'Argentina' },
  { name: 'Santiago', location: 'Santiago, CL', address: 'Alfredo Barros Errázuriz 1900, Santiago, Chile 7500537', phone: '+56 9 65623259', timezone: 'America/Santiago', capacity: 40, country: 'Chile' },
  // Central America
  { name: 'Guatemala City', location: 'Guatemala City, GT', address: 'Europlaza World Business Center Tower 2, Suite #1402, Guatemala City', phone: '+502 2293 3662', timezone: 'America/Guatemala', capacity: 30, country: 'Guatemala' },
  // India
  { name: 'Pune', location: 'Pune, IN', address: '2nd Floor, 66, Lane No. 2, Aundh, Pune 411007', phone: '+91 9513101766', timezone: 'Asia/Kolkata', capacity: 50, country: 'India' },
];

export async function updateOffices(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Office update requested');

  const authHeader = request.headers.get('x-init-key');
  if (authHeader !== process.env.INIT_SECRET_KEY) {
    return { status: 401, body: 'Unauthorized' };
  }

  const pool = new Pool({
    connectionString: process.env.POSTGRES_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // First, add address and phone columns if they don't exist
    await pool.query(`
      ALTER TABLE offices ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE offices ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE offices ADD COLUMN IF NOT EXISTS country VARCHAR(100);
    `);

    // Clear existing offices and insert new ones
    await pool.query('DELETE FROM offices');

    for (const office of offices) {
      await pool.query(
        `INSERT INTO offices (name, location, address, phone, capacity, timezone, country, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [office.name, office.location, office.address, office.phone, office.capacity, office.timezone, office.country]
      );
    }

    context.log(`Updated ${offices.length} offices`);
    return {
      status: 200,
      jsonBody: { success: true, message: `Updated ${offices.length} offices`, offices: offices.map(o => o.name) },
    };
  } catch (error) {
    context.error('Office update failed:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: String(error) },
    };
  } finally {
    await pool.end();
  }
}

app.http('updateOffices', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: updateOffices,
});
