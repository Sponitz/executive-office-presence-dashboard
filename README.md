# Improving Pulse

The pulse of Improving - Executive dashboard for monitoring office attendance and presence trends using EZRADIUS and UniFi Access data.

## Features

- **Real-time Occupancy**: Track current office occupancy across all locations
- **Attendance Trends**: Visualize daily, weekly, and monthly attendance patterns
- **Peak Hours Analysis**: Heatmap showing busiest times by day and hour
- **Multi-Office Support**: Compare metrics across 6+ office locations
- **Role-Based Access**: Different views based on Entra ID security groups
  - **Executive**: Full access to all data including individual user details
  - **Manager**: Access to aggregated data and team presence
  - **Viewer**: Basic attendance metrics only

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Recharts for data visualization
- MSAL.js for Azure AD authentication
- React Router for navigation

### Backend (Azure)
- Azure Functions (Node.js/TypeScript)
- Azure Database for PostgreSQL
- Azure App Service for hosting

### Data Sources
- EZRADIUS for RADIUS certificate authentication events
- UniFi Access for physical door access events

## Getting Started

### Prerequisites
- Node.js 20+
- Azure subscription
- Entra ID (Azure AD) tenant
- EZRADIUS API access
- UniFi Access controller

### Frontend Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables in `.env`:
   ```
   VITE_AZURE_CLIENT_ID=your-client-id
   VITE_AZURE_TENANT_ID=your-tenant-id
   VITE_API_BASE_URL=https://your-function-app.azurewebsites.net/api
   VITE_DEMO_MODE=false
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

### Azure Functions Setup

1. Navigate to azure-functions directory:
   ```bash
   cd azure-functions
   npm install
   ```

2. Configure `local.settings.json` with your credentials

3. Start functions locally:
   ```bash
   npm start
   ```

### Database Setup

1. Create Azure Database for PostgreSQL Flexible Server
2. Run the schema script:
   ```bash
   psql -h your-server.postgres.database.azure.com -U admin -d office_presence -f database/schema.sql
   ```

## Entra ID Configuration

### App Registration

1. Go to Azure Portal → Entra ID → App registrations
2. Create new registration:
   - Name: Improving Pulse
   - Supported account types: Single tenant
   - Redirect URI: `https://your-app.azurewebsites.net` (Web)

3. Configure Authentication:
   - Add redirect URI for local dev: `http://localhost:3000`
   - Enable ID tokens

4. API Permissions:
   - Microsoft Graph: `User.Read`, `GroupMember.Read.All`

### Security Groups

Create these security groups in Entra ID for role-based access:
- `Office-Dashboard-Executives` - Full access
- `Office-Dashboard-Managers` - Manager access
- `Office-Dashboard-Viewers` - Basic access

## Project Structure

```
improving-pulse/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── context/        # React context (auth)
│   ├── hooks/          # Custom hooks
│   ├── types/          # TypeScript types
│   ├── utils/          # Utilities and mock data
│   ├── config/         # Configuration (MSAL)
│   └── services/       # API services
├── azure-functions/
│   └── src/
│       ├── functions/  # Azure Function handlers
│       ├── services/   # Database and API services
│       └── types/      # TypeScript types
├── database/
│   └── schema.sql      # PostgreSQL schema
└── public/             # Static assets
```

## Demo Mode

Set `VITE_DEMO_MODE=true` to run with mock data without connecting to real APIs. This is useful for:
- Development without API access
- Demonstrations
- Testing UI changes

## Deployment

### Frontend (Azure App Service)

```bash
npm run build
az webapp deployment source config-zip -g your-rg -n your-app --src dist.zip
```

### Azure Functions

```bash
cd azure-functions
npm run build
func azure functionapp publish your-function-app
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /api/stats | Dashboard summary statistics |
| GET /api/attendance | Daily attendance data |
| GET /api/hourly-occupancy | Hourly occupancy for heatmap |
| GET /api/offices | List of offices with current occupancy |
| GET /api/user-presence | User presence summaries |

## License

ISC
