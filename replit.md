# BIMCall - Coordination Meeting Manager

## Overview

BIMCall is a full-stack web application designed to streamline BIM (Building Information Modeling) coordination meetings. It manages scheduling, agendas, coordination points, status tracking, and project management for construction projects. The platform aims to provide construction teams with tools to organize meetings, track action items, manage attendees, and monitor project progress across multiple locations, leveraging real-time data management.

## User Preferences

Preferred communication style: Simple, everyday language.

**Important Development Rule**: Always apply changes to both the regular meetings page (`meeting-detail.tsx`) AND the recurring series page (`series-detail.tsx`) together, even if only one is explicitly mentioned. These pages share similar functionality and should stay in sync.

## System Architecture

### Frontend Architecture

-   **Framework & Build System**: React 18 with TypeScript, Vite, and Wouter for routing.
-   **UI Component System**: shadcn/ui (Radix UI based) with Tailwind CSS for styling and Lucide React for icons. Dark mode is supported via CSS variables.
-   **State Management**: TanStack Query for server state and caching; local React state for UI interactions.
-   **Form Handling**: React Hook Form with Zod for validation, integrating with Drizzle-Zod.

### Backend Architecture

-   **Runtime & Framework**: Node.js with Express.js, TypeScript, and `tsx` for development. `esbuild` for optimized production builds.
-   **API Design**: RESTful API under `/api/*` using JSON for requests/responses.
-   **Build Strategy**: Separate client (Vite to `dist/public`) and server (`esbuild` to `dist/index.cjs`) builds.

### Data Storage

-   **Database**: PostgreSQL via Neon serverless driver, managed with Drizzle ORM for type-safe queries and migrations.
-   **Schema Design**: Key entities include Projects, Meetings, Points, Attendees, SeriesAttendees, AttendanceRecords, StatusUpdates, and Attachments. Supports cascade deletes and schema-first approach.
-   **Data Layer Abstraction**: `server/storage.ts` provides a repository-style interface for database operations, including filtering.

### System Design Choices & Features

-   **UI/UX**: Consistent theming with custom design tokens, shadcn/ui components for accessibility. Breadcrumb navigation on detail pages (Meeting, Series, Project) for intuitive back-navigation. All dialogs include proper aria-describedby for accessibility. Cards are fully clickable with consistent hover states.
-   **Unified Meetings Page**: Single dashboard (`/`) with List and Calendar view toggle, plus type filter (All/Meetings/Series). Streamlined navigation removes separate Calendar and Series pages in favor of inline switching.
-   **Real-time Features**: Leveraging modern web technologies for real-time data synchronization.
-   **Meeting Management**: Comprehensive tools for scheduling, agenda creation, and coordination point tracking.
-   **Project Management**: Track project metadata, manage attendees, and monitor progress.
-   **Recurring Meetings**: Support for defining meeting series and managing individual occurrences.
-   **Enhanced Attendee Management**: Detailed attendee profiles, CSV import, attendance tracking, and search/filter capabilities.
-   **Point Assignment**: Integration with attendee lists, dual-write system for `assignedTo` (display name) and `assignedToRef` (canonical ID).
-   **Entity Management**: Standardized edit dialogs and action menus (Edit/Delete) for all core entities (Projects, Meetings, Series, Points).
-   **Meeting Minutes & Export**: Dialog for previewing and sending minutes, with export options (PDF, Word, CSV).
-   **Calendar Integration**: ICS file export, direct Google/Outlook Calendar integration, calendar event import/sync for meetings and series, day-click actions (create meeting/series, import events for specific date), and bulk import with ICS file upload, date range picker, and filtering.
-   **Image Uploads**: Ability to upload images for coordination points.
-   **Global Project Filter**: App-wide multi-select filter for projects affecting meetings and calendar views.
-   **Email Attachment Import**: Ability to import attachments from emails when adding new points, with support for Gmail and Outlook.
-   **Discipline Tagging System**: Optional many-to-many discipline assignments for Points, Meetings, and Series with 11 MVP disciplines (GEN, ARCH, STR, MEP, EL, MECH, PL, FIRE, ICT, CIVIL, QA). Includes reusable `DisciplineMultiSelect` component and `DisciplineBadges` display component with color-coded badges. Disciplines are pre-seeded on server startup.
-   **Meeting/Series Closing System**: Meetings and series can be closed with two options: (1) move open points to another meeting/series, or (2) mark all points as closed. Closed meetings/series display a "Closed" badge with Lock icon. A "Show Closed" checkbox filter on the dashboard allows viewing closed meetings and series. Closed meetings/series can be reopened by users with appropriate permissions.
-   **Analytics Dashboard**: Comprehensive analytics page at `/analytics` with KPIs, charts for points by status/discipline, meetings by month, and project statistics.
-   **Gantt Chart / Timeline**: Project timeline visualization at `/gantt` showing projects with start/end dates as horizontal bars.
-   **IFC Viewer**: File upload interface at `/ifc-viewer` for BIM/IFC 3D model files. Displays model information (name, size, format) and provides download and external viewer options (BIMvision, Autodesk Viewer, Trimble Connect).

### Authentication System

-   **JWT-Based Authentication**: Custom authentication using JSON Web Tokens stored in HTTP-only cookies for security.
-   **Login Methods**: Email/password authentication with bcrypt password hashing.
-   **Self-Registration**: New users can register and automatically receive the VIEWER role. Admins can later upgrade roles and assign projects.
-   **Auth Routes**: 
    -   `POST /api/auth/register` - Create new account
    -   `POST /api/auth/login` - Login with email/password
    -   `POST /api/auth/logout` - Logout and clear session
    -   `GET /api/auth/me` - Get current user session
    -   `POST /api/auth/change-password` - Change password for authenticated users
-   **Login Page**: `/login` route with Sign In and Create Account tabs.
-   **Profile Page**: `/profile` route showing user info, assigned projects, roles, and password change functionality.
-   **Social Login Preparation**: Database schema supports Google and Microsoft OAuth (fields: `googleId`, `microsoftId`, `authProvider`). UI shows disabled buttons pending OAuth implementation.

### Role-Based Access Control (RBAC)

-   **User Management**: Users page (`/users`) for managing users, companies, and roles with permission-gated actions.
-   **Companies**: Users can be assigned to companies for organizational grouping.

#### Dual Role System

Users have two types of roles that work together:

1. **Company Role** (stored on `users.companyRole`): User's role within their company
    - `OWNER`: Company founder with full control
    - `ADMIN`: Can manage company settings and employees
    - `DEPARTMENT_MANAGER`: Manages a department
    - `EMPLOYEE`: Regular company employee
    - `GUEST`: External collaborator

2. **Project Role** (stored on `projectUsers.projectRole`): User's role within a specific project
    - `PROJECT_LEADER`: Overall project leadership
    - `BIM_MANAGER`: Manages BIM processes and coordination
    - `BIM_COORDINATOR`: Coordinates BIM models
    - `DESIGN_LEAD`: Leads design direction
    - `DESIGN_MANAGER`: Manages design team
    - `DESIGN_TEAM_MEMBER`: Creates design documentation
    - `ENGINEER`: Technical engineering role
    - `EXTERNAL_CONSULTANT`: External advisor
    - `PROJECT_VIEWER`: View-only access (default)

Both roles are displayed on team member cards in the Project Detail page with distinct badges. Project roles can be changed via the dropdown menu on each team member card.

#### App-Level Roles (Permissions)

These roles control what actions a user can perform (defined in `server/permissions.ts`):
-   `BIM_MANAGER`: Full administrative access to all features and projects.
-   `BIM_PROJECT_MANAGER`: Project-specific management with full access to assigned projects.
-   `BIM_COORDINATOR`: Coordinate meetings and points within assigned projects.
-   `BIM_DESIGNER`: Can edit only points assigned to them.
-   `ENGINEER`: Technical role with limited editing permissions.
-   `PROJECT_MANAGER`: Company-scoped access with project management capabilities.
-   `DESIGN_MANAGER`: Design-focused management role.
-   `VIEWER`: Read-only access to view data without modifications.

-   **Project Access**: Users can be assigned to specific projects; BIM Managers have global access.
-   **Permission Matrix**: Defined in `server/permissions.ts` with `authorizeGlobal()` and `authorizeForProject()` utilities.
-   **Auth Context**: Frontend uses `AuthProvider` in `client/src/contexts/auth-context.tsx` with hooks: `useAuth()`, `useHasPermission()`, `useCanEditPoint()`, `useCanAccessProject()`. Exports `PROJECT_ROLE_DISPLAY_NAMES`, `PROJECT_ROLE_COLORS`, `COMPANY_ROLE_DISPLAY_NAMES`, `COMPANY_ROLE_COLORS` for consistent styling.
-   **Development User Switcher**: Users page allows switching between users for testing different role permissions via localStorage-based dev headers (development mode only).

## External Dependencies

-   **Database Services**: Neon Serverless PostgreSQL (`@neondatabase/serverless`), Drizzle Kit.
-   **UI Libraries**: Radix UI, Tailwind CSS v4, `date-fns`, `embla-carousel-react`, Lucide React.
-   **Development Tools**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `vite-plugin-meta-images`.
-   **Type Safety & Validation**: Zod, `zod-validation-error`, `drizzle-zod`.
-   **Fonts & Assets**: Google Fonts (Inter, JetBrains Mono), custom favicon/OpenGraph images.
-   **Document Generation**: jsPDF for PDF export.