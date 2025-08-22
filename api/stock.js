const yahooFinance = require("yahoo-finance2").default;
const { PrismaClient } = require('@prisma/client');

const API_SECRET_KEY = process.env.API_SECRET_KEY;

if (!API_SECRET_KEY) {
    console.error('API_SECRET_KEY environment variable is required');
    process.exit(1);
}
const prisma = new PrismaClient();

async function getOrUpdateStockPrice(symbol, date) {
    try {
        const symbolUpper = symbol.toUpperCase();
        const dateObj = new Date(date);
        
        // Check if we have recent data (within 5 minutes)
        const existingRecord = await prisma.stockprice.findUnique({
            where: {
                symbol_date: {
                    symbol: symbolUpper,
                    date: dateObj,
                }
            }
        });

        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        // If record exists and was updated within 5 minutes, return cached data
        if (existingRecord && existingRecord.updated_at > fiveMinutesAgo) {
            return {
                symbol: existingRecord.symbol,
                price: existingRecord.close,
                change: existingRecord.change,
                percentChange: existingRecord.percentChange,
                cached: true,
                lastUpdated: existingRecord.updated_at
            };
        }

        // Otherwise, fetch fresh data from Yahoo Finance
        const result = await yahooFinance.quote(symbolUpper);
        const price = result.regularMarketPrice;
        const change = result.regularMarketChange;
        const percentChange = result.regularMarketChangePercent;

        // Update or create record
        const updatedRecord = await prisma.stockprice.upsert({
            where: {
                symbol_date: {
                    symbol: symbolUpper,
                    date: dateObj,
                }
            },
            update: {
                close: price,
                change: change,
                percentChange: percentChange,
            },
            create: {
                symbol: symbolUpper,
                date: dateObj,
                close: price,
                change: change,
                percentChange: percentChange,
            }
        });

        return {
            symbol: result.symbol,
            price: price,
            change: result.regularMarketChange,
            percentChange: result.regularMarketChangePercent,
            cached: false,
            lastUpdated: updatedRecord.updated_at
        };
    } catch (error) {
        console.error("Error getting/updating stock price:", error);
        throw new Error("Failed to get stock price");
    }
}

// API to fetch stock data
module.exports = async (req, res) => {
    // Handle CORS headers for all requests
    const allowedOrigins = [
        'http://localhost:3000'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const symbol = req.query.symbol;
    const apiKey = req.query.apiKey;

    if (!symbol) {
        return res.status(400).json({ error: "Missing symbol" });
    }

    if (!apiKey || apiKey !== API_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized: Invalid API key" });
    }

    try {
        const today = new Date().toISOString().slice(0, 10);
        const stockData = await getOrUpdateStockPrice(symbol, today);
        
        res.json(stockData);
    } catch (error) {
        console.error("Stock API Error:", error);
        res.status(500).json({ error: "Failed to fetch stock data" });
    }
};
