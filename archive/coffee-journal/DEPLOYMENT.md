# 🚀 Deployment Guide

This guide will help you deploy your Coffee Journal application to the web with a proper backend database.

## Prerequisites

1. **Node.js 18+** installed
2. **Git** for version control
3. **A PostgreSQL database** (see options below)

## Database Setup Options

### Option 1: Supabase (Recommended for beginners)
1. Go to [supabase.com](https://supabase.com)
2. Create a free account
3. Create a new project
4. Go to Settings → Database
5. Copy the connection string
6. Update your `.env` file with the connection string

### Option 2: Railway
1. Go to [railway.app](https://railway.app)
2. Create an account
3. Create a new project
4. Add a PostgreSQL database
5. Copy the connection string

### Option 3: Neon
1. Go to [neon.tech](https://neon.tech)
2. Create a free account
3. Create a new project
4. Copy the connection string

### Option 4: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database named `coffee_journal`
3. Use connection string: `postgresql://username:password@localhost:5432/coffee_journal`

## Environment Setup

1. **Create a `.env` file** in the root directory:
   ```bash
   cp .env.example .env
   ```

2. **Update the `.env` file** with your database URL:
   ```env
   DATABASE_URL="your-database-connection-string"
   NODE_ENV="production"
   ```

## Database Migration

1. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

2. **Run database migrations**:
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Verify the database**:
   ```bash
   npx prisma studio
   ```

## Deployment Options

### Option 1: Vercel (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/coffee-journal.git
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Connect your GitHub repository
   - Add your environment variables in the Vercel dashboard
   - Deploy!

### Option 2: Railway

1. **Connect to Railway**:
   - Go to [railway.app](https://railway.app)
   - Connect your GitHub repository
   - Add environment variables
   - Deploy!

### Option 3: Netlify

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop your `out` folder
   - Or connect your GitHub repository

## Environment Variables for Production

Make sure to set these in your deployment platform:

```env
DATABASE_URL="your-production-database-url"
NODE_ENV="production"
```

## Database Connection Pooling (Recommended for Production)

For production, consider using connection pooling:

1. **Install the pooling package**:
   ```bash
   npm install @prisma/pool
   ```

2. **Update your Prisma client** in `src/lib/prisma.ts`:
   ```typescript
   import { PrismaClient } from '@prisma/client';
   import { Pool } from '@prisma/pool';

   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });

   export const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL,
       },
     },
   });
   ```

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   - Check your `DATABASE_URL` format
   - Ensure your database is accessible
   - Verify firewall settings

2. **Migration errors**:
   - Run `npx prisma migrate reset` to reset the database
   - Check your schema for syntax errors

3. **Build errors**:
   - Ensure all dependencies are installed
   - Check TypeScript errors
   - Verify environment variables

### Debugging

1. **Check logs** in your deployment platform
2. **Test locally** with `npm run dev`
3. **Verify database** with `npx prisma studio`

## Security Considerations

1. **Environment variables**: Never commit `.env` files
2. **Database security**: Use strong passwords and SSL connections
3. **API security**: Consider adding authentication for production
4. **CORS**: Configure CORS if needed

## Performance Optimization

1. **Database indexes**: Already configured in the schema
2. **Connection pooling**: Implement for high traffic
3. **Caching**: Consider Redis for caching
4. **CDN**: Use Vercel's edge network or similar

## Monitoring

1. **Error tracking**: Add Sentry or similar
2. **Performance monitoring**: Use Vercel Analytics
3. **Database monitoring**: Monitor query performance
4. **Uptime monitoring**: Set up alerts

## Next Steps

After deployment, consider adding:

- [ ] User authentication
- [ ] Image uploads for coffee photos
- [ ] Social sharing features
- [ ] Advanced filtering and search
- [ ] Export functionality
- [ ] Mobile app version

---

**Happy Deploying! ☕** 