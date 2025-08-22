# Yahoo Stock API

A stock portfolio management API with Yahoo Finance integration, built with Node.js, Prisma, and PostgreSQL. This API allows you to manage stock portfolios, track transactions, and retrieve historical stock data.

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd yahoo-stock-api-opensource
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure your `.env` file** (see [Environment Variables](#environment-variables) section)

5. **Set up the database** (see [Database Setup](#database-setup) section)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="your_database_url_here"

# Authentication
JWT_SECRET="your_jwt_secret_key_here"
API_SECRET_KEY="your_api_secret_key_here"

# Google OAuth (optional - only needed if using Google authentication)
GOOGLE_CLIENT_ID="your_google_client_id_here"

# Email Configuration (for OTP and welcome emails)
RESEND_API_KEY="your_resend_api_key_here"
FROM_EMAIL="noreply@yourdomain.com"
```

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes |
| `JWT_SECRET` | Secret key for JWT token signing | ✅ Yes |
| `API_SECRET_KEY` | API key for accessing stock endpoints | ✅ Yes |
| `RESEND_API_KEY` | Resend API key for sending emails | ✅ Yes |
| `FROM_EMAIL` | Email address for sending notifications | ✅ Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ Optional |

## Database Setup

This project uses Prisma with PostgreSQL. You have several options for setting up the database:

### Option 1: Prisma Dev Database (Recommended for Development)

```bash
# Start Prisma's local PostgreSQL instance
npx prisma dev

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

Your `DATABASE_URL` should be:
```env
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."
```

### Option 2: Docker PostgreSQL

```bash
# Create docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: yahoo_stock_api
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
EOF

# Start database
docker-compose up -d

# Run Prisma setup
npx prisma generate
npx prisma db push
```

Your `DATABASE_URL` should be:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yahoo_stock_api"
```

### Option 3: Hosted PostgreSQL

Use a hosted PostgreSQL service (Supabase, PlanetScale, etc.) and set your `DATABASE_URL` accordingly.

## Running the Application

### Development

1. **Start the database**
   ```bash
   npx prisma dev  # If using Prisma dev database
   # OR
   docker-compose up -d  # If using Docker
   ```

2. **Generate Prisma client** (if not done already)
   ```bash
   npx prisma generate
   ```
### Local Testing with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev
```

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Login with Google
- `POST /api/auth/verify-otp` - Verify OTP code

### Stock Endpoints

All stock endpoints require `apiKey` parameter with your `API_SECRET_KEY`.

- `GET /api/stock?symbol=AAPL&apiKey=your_key` - Get current stock price
- `GET /api/stock/history?symbol=AAPL&days=30&apiKey=your_key` - Get historical data
- `POST /api/stock/history-bulk` - Get bulk historical data

### Portfolio Endpoints

These require JWT authentication via `Authorization: Bearer <token>` header.

- `POST /api/portfolio/create` - Create portfolio
- `GET /api/user/portfolios` - Get user's portfolios
- `POST /api/transaction/add-to-portfolio` - Add transaction
- `POST /api/transaction/bulk-create` - Bulk create transactions

## Example Usage

### Get Stock Price

```bash
curl "http://localhost:8080/api/stock?symbol=AAPL&apiKey=your_secret_key"
```

### Create Account

```bash
curl -X POST "https://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "name": "John Doe"
  }'
```

### Prisma Studio

View and manage your database:
```bash
npx prisma studio
```
Opens at http://localhost:5555

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues:

1. Check the [Environment Variables](#environment-variables) section
2. Ensure your database is running
3. Verify all required environment variables are set

## Acknowledgments

- [Yahoo Finance API](https://github.com/gadicc/node-yahoo-finance2) for stock data
- [Prisma](https://prisma.io/) for database management
- [Resend](https://resend.com/) for email services