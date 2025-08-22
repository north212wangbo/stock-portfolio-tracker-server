# Stock Portfolio Tracker Server

A TradingView style stock portfolio management API with Yahoo Finance integration, built with Node.js, Prisma, and PostgreSQL. This API allows you to manage stock portfolios, track transactions, and retrieve historical stock data.

## Installation

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Install Vercel CLI (Vercel will be installed globally if not installed before)**
   ```bash
   npm i -g vercel
   ```   

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Set up the database** (see [Database Setup](#database-setup) section)

5. **Configure your `.env` file** (see [Environment Variables](#environment-variables) section)

## Environment Variables

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
| `RESEND_API_KEY` | Resend API key for sending emails | ❌ Optional |
| `FROM_EMAIL` | Email address for sending notifications | ❌ Optional |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ❌ Optional |

## Database Setup

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
Opens at http://localhost:5555

Your `DATABASE_URL` should be generated from npx prisma dev:
```env
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=..."
```

## Running the Application

### Development

1. **Start the database**
   ```bash
   npx prisma dev  # If using Prisma dev database
   ```

2. **Generate Prisma client** (if not done already)
   ```bash
   npx prisma generate
   ```
3. **Local Testing with Vercel CLI**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Run locally
   vercel dev --listen 8080
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