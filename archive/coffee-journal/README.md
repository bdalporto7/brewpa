# ☕ Coffee Journal

A modern, TypeScript-based web application for coffee enthusiasts to track and record their brewing experiences. Built with Next.js, React, SQLite (development), and PostgreSQL (production).

## Features

### 📝 Coffee Entry Management
- **Comprehensive Form**: Record detailed information about each brew including:
  - Coffee name and origin
  - Roast level (Light to Very Dark)
  - Brew method (Espresso, Pour-over, French Press, AeroPress, etc.)
  - Grind size with helpful descriptions
  - Water temperature (°C)
  - Coffee and water weights (g)
  - Brew time (minutes)
  - Rating system (1-5 stars)
  - Notes and observations

### 📊 Statistics Dashboard
- **Brewing Insights**: View your coffee brewing statistics:
  - Total entries recorded
  - Average rating across all brews
  - Number of brews this month
  - Favorite origin
  - Most used brew method
- **Helpful Tips**: Get brewing tips and suggestions

### 🎨 Modern UI/UX
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Clean Interface**: Intuitive and user-friendly design
- **Real-time Validation**: Form validation with helpful error messages
- **Modal Forms**: Clean modal interface for adding/editing entries
- **Card Layout**: Beautiful card-based layout for coffee entries

### 🗄️ Backend & Database
- **SQLite** for local development (easy setup, no configuration)
- **PostgreSQL** for production (scalable, robust)
- **Prisma ORM**: Type-safe database operations
- **RESTful API**: Clean API endpoints for all operations
- **Data Persistence**: All data stored securely
- **Production Ready**: Deployable to any platform

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Heroicons
- **State Management**: React Hooks with custom hooks

### Backend
- **API**: Next.js API Routes
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **ORM**: Prisma
- **Validation**: Custom validation with TypeScript
- **Error Handling**: Comprehensive error handling

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository** (if you have the source code):
   ```bash
   git clone <repository-url>
   cd coffee-journal
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up the database** (SQLite for development):
   ```bash
   # The database is already configured for SQLite
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npx prisma studio` - Open database GUI
- `npx prisma migrate dev` - Run database migrations
- `./scripts/setup-db.sh dev` - Set up SQLite for development
- `./scripts/setup-db.sh prod` - Set up PostgreSQL for production

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── coffee-entries/    # Coffee entries API
│   │   └── stats/            # Statistics API
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page component
│   └── globals.css        # Global styles
├── components/             # React components
│   ├── CoffeeEntryForm.tsx    # Form for adding/editing
│   ├── CoffeeEntryCard.tsx    # Card display component
│   └── StatsDashboard.tsx     # Statistics dashboard
├── hooks/                 # Custom React hooks
│   └── useCoffeeEntries.ts    # Coffee entries management
├── lib/                   # Library utilities
│   └── prisma.ts             # Prisma client
├── types/                 # TypeScript definitions
│   └── coffee.ts             # Coffee-related interfaces
└── utils/                 # Utility functions
    └── constants.ts           # Constants and helpers

prisma/
├── schema.prisma          # SQLite schema (development)
├── schema.postgresql.prisma # PostgreSQL schema (production)
└── migrations/            # Database migrations

scripts/
└── setup-db.sh           # Database setup script
```

## Database Setup

### Development (SQLite)
The application is configured to use SQLite for local development by default. This requires no additional setup:

```bash
# Database is already configured
npx prisma migrate dev --name init
```

### Production (PostgreSQL)
To switch to PostgreSQL for production:

```bash
# Set up PostgreSQL schema
./scripts/setup-db.sh prod

# Update your .env file with PostgreSQL connection string
# DATABASE_URL="postgresql://user:password@localhost:5432/coffee_journal"

# Run migrations
npx prisma migrate deploy
```

## API Endpoints

### Coffee Entries
- `GET /api/coffee-entries` - List all entries (with pagination and filtering)
- `POST /api/coffee-entries` - Create new entry
- `GET /api/coffee-entries/[id]` - Get specific entry
- `PUT /api/coffee-entries/[id]` - Update entry
- `DELETE /api/coffee-entries/[id]` - Delete entry

### Statistics
- `GET /api/stats` - Get brewing statistics

## Database Schema

### CoffeeEntry Model
```sql
model CoffeeEntry {
  id               String   @id @default(cuid())
  name             String
  roastLevel       String
  origin           String
  grindSize        String
  brewMethod       String
  waterTemperature Float
  coffeeWeight     Float
  waterWeight      Float
  brewTime         Float
  rating           Float
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([createdAt])
  @@index([brewMethod])
  @@index([roastLevel])
  @@index([rating])
  @@index([origin])
}
```

## Deployment

This application is designed to be deployed to any platform that supports Next.js:

### Quick Deploy Options
1. **Vercel** (Recommended) - [Deploy Guide](DEPLOYMENT.md)
2. **Railway** - Full-stack deployment
3. **Netlify** - Static deployment
4. **AWS/GCP/Azure** - Custom deployment

### Database Options
1. **Supabase** (Recommended for beginners)
2. **Railway** - Managed PostgreSQL
3. **Neon** - Serverless PostgreSQL
4. **AWS RDS** - Enterprise-grade

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Key Components

### CoffeeEntryForm
A comprehensive form component that handles:
- Input validation
- Real-time ratio calculation
- Form state management
- Error handling
- API integration

### CoffeeEntryCard
Displays coffee entries with:
- Star rating visualization
- Brew method icons
- Detailed brewing parameters
- Edit/delete actions

### StatsDashboard
Shows brewing statistics including:
- Total entries count
- Average rating
- Monthly brew count
- Favorite origins and methods

### useCoffeeEntries Hook
Custom hook providing:
- CRUD operations for coffee entries
- API integration
- Data validation
- Statistics calculation

## Brew Methods Supported

- ☕ Espresso
- 🫖 Pour Over
- 🥤 French Press
- ⚡ AeroPress
- 🫘 Moka Pot
- 🧊 Cold Brew
- 💧 Drip
- 🔬 Siphon
- 🧪 Chemex
- 📐 V60
- 🏔️ Kalita
- ☕ Other

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] User authentication and cloud sync
- [ ] Photo uploads for coffee beans and brews
- [ ] Advanced filtering and search
- [ ] Export data to CSV/PDF
- [ ] Coffee bean inventory management
- [ ] Brewing timer integration
- [ ] Social sharing features
- [ ] Coffee bean recommendations
- [ ] Brewing recipe templates
- [ ] Real-time collaboration
- [ ] Mobile app version

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with ❤️ for coffee enthusiasts
- Inspired by the art and science of coffee brewing
- Special thanks to the coffee community for brewing knowledge
- Powered by Next.js, Prisma, and SQLite/PostgreSQL

---

**Happy Brewing! ☕**
