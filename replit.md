# HRM Portal - Lead Management System

## Overview

The HRM Portal is a comprehensive lead management system designed for HR teams with role-based access control. The application supports multiple user roles (Manager, HR, Accounts, Admin) with distinct permissions and workflows. The system enables efficient lead tracking from initial contact through completion, with features like bulk Excel uploads, real-time analytics, audit trails, and automated role-based lead distribution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design
- **Styling**: Tailwind CSS with custom CSS variables for theming and dark mode support
- **State Management**: TanStack Query (React Query) for server state management with optimistic updates
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation schemas
- **Charts**: Chart.js for data visualization and analytics dashboards

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with role-based route protection
- **File Uploads**: Multer middleware for handling Excel file uploads
- **Excel Processing**: xlsx library for parsing and processing spreadsheet data
- **Authentication**: Replit Auth integration with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL session store
- **Password Security**: bcrypt for password hashing
- **WebSocket Support**: WebSocket server for real-time features (notifications, live updates)

### Database Architecture
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Migration System**: Drizzle Kit for database schema migrations
- **Connection Pooling**: Neon serverless connection pooling
- **Schema Design**: Normalized relational schema with proper foreign key constraints

### Key Data Models
- **Users**: Role-based user management (manager, hr, accounts, admin)
- **Leads**: Complete lead lifecycle tracking with status progression
- **Lead History**: Comprehensive audit trail for all lead changes
- **Uploads**: File upload tracking and batch processing records
- **Sessions**: Secure session management for authentication

### Authentication & Authorization
- **Identity Provider**: Replit Auth with OIDC integration
- **Session Storage**: PostgreSQL-backed session store with configurable TTL
- **Role-Based Access Control**: Granular permissions based on user roles
- **Route Protection**: Middleware-based authentication checks on API endpoints
- **Frontend Guards**: React components with role-based rendering

### Lead Management Workflow
- **Manager Role**: Full system access, user management, bulk uploads, analytics
- **HR Role**: Lead processing, status updates, scheduling, completion marking
- **Accounts Role**: Financial processing of completed leads from HR
- **Admin Role**: System administration and reporting capabilities

### File Processing System
- **Upload Strategy**: In-memory processing with Multer
- **Excel Parsing**: Support for multiple spreadsheet formats
- **Bulk Processing**: Batch lead creation with error handling and reporting
- **Allocation Strategies**: Multiple lead distribution methods (round-robin, manual assignment)

### Real-time Features
- **WebSocket Server**: Live notifications and updates
- **Query Invalidation**: Automatic UI updates when data changes
- **Optimistic Updates**: Immediate UI feedback for better user experience

## External Dependencies

### Database & Storage
- **Neon PostgreSQL**: Serverless PostgreSQL database with connection pooling
- **Drizzle ORM**: Type-safe database operations and migrations

### Authentication
- **Replit Auth**: OAuth 2.0/OIDC authentication provider
- **OpenID Client**: OIDC protocol implementation for secure authentication

### UI & Styling
- **Radix UI**: Accessible, unstyled UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom theming
- **Lucide React**: Consistent icon library

### Form & Validation
- **React Hook Form**: Performant form library with minimal re-renders
- **Zod**: TypeScript-first schema validation

### Data & Charts
- **TanStack Query**: Server state management with caching
- **Chart.js**: Canvas-based charting library for analytics

### File Processing
- **Multer**: Multipart form data handling for file uploads
- **xlsx**: Excel file parsing and processing

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety and better developer experience
- **Replit Plugins**: Development environment integration