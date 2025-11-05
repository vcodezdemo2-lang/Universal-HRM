# HRM Portal - Advanced Lead Management System

A full-stack Human Resources Management portal for tracking and managing leads with role-based access control, real-time analytics, and automated workflows.

![HRM Portal](https://img.shields.io/badge/Node.js-20.x-green) ![HRM Portal](https://img.shields.io/badge/React-18.x-blue) ![HRM Portal](https://img.shields.io/badge/TypeScript-5.x-blue)

## Features

- **Multi-Role Management** - Support for Manager, HR, Accounts, and Admin roles with granular permissions
- **Real-time Analytics** - Interactive dashboards with live metrics and performance tracking
- **Audit Trail** - Complete audit trail for all lead modifications and status changes
- **WebSocket Integration** - Real-time updates across all connected clients
- **Secure Authentication** - Password-based authentication with bcrypt hashing
- **Lead Management** - Comprehensive lead tracking with status workflows
- **Export Functionality** - Export leads to Excel/CSV formats
- **Dark Mode Support** - Full dark mode implementation
- **Responsive Design** - Mobile-friendly interface built with Tailwind CSS

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Wouter** - Routing
- **TanStack Query** - Data fetching and caching
- **Shadcn UI** - Component library
- **Recharts** - Data visualization
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Database (via Neon)
- **Drizzle ORM** - Database ORM
- **WebSocket (ws)** - Real-time communication
- **Passport.js** - Authentication
- **bcrypt** - Password hashing

## Quick Start

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL database
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd hrm-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MANAGER_EMAIL=manager@example.com
   MANAGER_PASSWORD=YourSecurePassword123!
   DATABASE_URL=postgresql://username:password@host:5432/database
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open http://localhost:5000 in your browser

### Default Login
- **Email**: The email you set in `MANAGER_EMAIL`
- **Password**: The password you set in `MANAGER_PASSWORD`

**⚠️ Important**: Change the default password immediately after first login!

## Production Deployment

This application can be deployed on multiple platforms. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions for:

- ✅ **Render** (Recommended - includes `render.yaml` config)
- ✅ **Heroku** (includes `Procfile`)
- ✅ **Railway**
- ✅ **Fly.io**
- ✅ **DigitalOcean App Platform**
- ✅ **AWS EC2 + RDS**
- ✅ **VPS (Ubuntu)**
- ✅ **Docker** (includes `Dockerfile` and `docker-compose.yml`)

### Quick Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

1. Push your code to GitHub
2. Import the repository in Render
3. The `render.yaml` will automatically configure everything
4. Set your environment variables
5. Deploy!

## Project Structure

```
.
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and helpers
├── server/                # Backend Express application
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Storage interface
│   ├── websocket.ts       # WebSocket handling
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema
├── Dockerfile             # Docker configuration
├── docker-compose.yml     # Docker Compose setup
├── Procfile               # Heroku configuration
├── render.yaml            # Render configuration
└── DEPLOYMENT.md          # Deployment guide
```

## Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run check      # TypeScript type checking
npm run db:push    # Push database schema changes
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 5000 |
| `NODE_ENV` | Environment (development/production) | No | development |
| `MANAGER_EMAIL` | Default manager email | Yes | - |
| `MANAGER_PASSWORD` | Default manager password | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |

## User Roles & Permissions

### Manager
- Full access to all features
- Can manage users and assign roles
- Access to all analytics and reports
- Can export data

### HR
- Manage leads
- View analytics
- Cannot manage users

### Accounts
- View leads
- Limited editing capabilities
- No user management

### Admin
- System administration
- User management
- Configuration access

## Database Schema

The application uses PostgreSQL with the following main tables:
- `users` - User accounts and authentication
- `leads` - Lead information and tracking
- `audit_logs` - Audit trail for all changes

See `shared/schema.ts` for the complete schema definition.

## WebSocket Events

The application uses WebSocket for real-time updates:
- `lead-created` - New lead added
- `lead-updated` - Lead modified
- `lead-deleted` - Lead removed
- `user-action` - User activity notifications

## Security

- ✅ Password hashing with bcrypt
- ✅ Session-based authentication
- ✅ Role-based access control (RBAC)
- ✅ SQL injection protection via Drizzle ORM
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Environment variable secrets

**Security Best Practices:**
1. Never commit `.env` files
2. Use strong, unique passwords
3. Enable HTTPS in production
4. Regularly update dependencies
5. Review audit logs regularly

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Build Issues
- Ensure Node.js version is 20.x or higher
- Delete `node_modules` and `package-lock.json`, then run `npm install`
- Check that all environment variables are set

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Ensure database accepts connections from your host

### WebSocket Issues
- Check that port 5000 is not blocked
- Verify WebSocket URL configuration
- Check browser console for errors

For more help, see [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting)

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For deployment-specific issues, consult the respective platform documentation:
- [Render Documentation](https://render.com/docs)
- [Heroku Documentation](https://devcenter.heroku.com/)
- [Railway Documentation](https://docs.railway.app/)

---

**Built with ❤️ using React, TypeScript, and Express**
