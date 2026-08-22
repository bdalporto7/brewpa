#!/bin/bash

# Database setup script for Coffee Journal
# This script helps you switch between SQLite (development) and PostgreSQL (production)

echo "☕ Coffee Journal Database Setup"
echo "================================"

if [ "$1" = "dev" ]; then
    echo "Setting up SQLite for development..."
    
    # Copy SQLite schema
    cp prisma/schema.prisma prisma/schema.prisma.backup
    echo 'DATABASE_URL="file:./dev.db"' > .env
    
    echo "✅ Development database configured (SQLite)"
    echo "Run 'npx prisma migrate dev' to set up the database"
    
elif [ "$1" = "prod" ]; then
    echo "Setting up PostgreSQL for production..."
    
    # Copy PostgreSQL schema
    cp prisma/schema.postgresql.prisma prisma/schema.prisma
    echo "Please update your .env file with your PostgreSQL DATABASE_URL"
    echo "Example: DATABASE_URL=\"postgresql://user:password@localhost:5432/coffee_journal\""
    
    echo "✅ Production database configured (PostgreSQL)"
    echo "Run 'npx prisma migrate deploy' to set up the database"
    
else
    echo "Usage: $0 [dev|prod]"
    echo ""
    echo "  dev  - Set up SQLite for local development"
    echo "  prod - Set up PostgreSQL for production"
    echo ""
    echo "Examples:"
    echo "  $0 dev   # Use SQLite for development"
    echo "  $0 prod  # Use PostgreSQL for production"
fi 