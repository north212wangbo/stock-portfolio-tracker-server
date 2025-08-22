const { PrismaClient } = require('@prisma/client');

const API_SECRET_KEY = process.env.API_SECRET_KEY;

if (!API_SECRET_KEY) {
    console.error('API_SECRET_KEY environment variable is required');
    process.exit(1);
}
const prisma = new PrismaClient();

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

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { symbol, days, apiKey } = req.query;

    // Validate required parameters
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol parameter is required' });
    }

    if (!days) {
        return res.status(400).json({ error: 'Days parameter is required' });
    }

    if (!apiKey || apiKey !== API_SECRET_KEY) {
        return res.status(403).json({ error: 'Unauthorized: Invalid API key' });
    }

    // Validate days parameter
    const numberOfDays = parseInt(days);
    if (isNaN(numberOfDays) || numberOfDays <= 0) {
        return res.status(400).json({ error: 'Days must be a positive integer' });
    }

    if (numberOfDays > 1825) { // 5 years limit
        return res.status(400).json({ error: 'Days cannot exceed 1825 (5 years)' });
    }

    try {
        // Calculate the cutoff date (now - number of days)
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (numberOfDays * 24 * 60 * 60 * 1000));

        // Query stockprice records where date >= cutoffDate
        const stockPrices = await prisma.stockprice.findMany({
            where: {
                symbol: symbol.toUpperCase(),
                date: {
                    gte: cutoffDate
                }
            },
            orderBy: {
                date: 'asc' // Oldest to newest for chart plotting
            }
        });

        // Calculate summary statistics
        const summary = {
            symbol: symbol.toUpperCase(),
            requestedDays: numberOfDays,
            actualRecords: stockPrices.length,
            dateRange: {
                cutoffDate: cutoffDate.toISOString().split('T')[0],
                today: new Date().toISOString().split('T')[0]
            }
        };

        if (stockPrices.length > 0) {
            const prices = stockPrices.map(record => record.close);
            const firstPrice = stockPrices[0].close;
            const lastPrice = stockPrices[stockPrices.length - 1].close;
            
            summary.priceRange = {
                earliest: {
                    date: stockPrices[0].date.toISOString().split('T')[0],
                    price: firstPrice
                },
                latest: {
                    date: stockPrices[stockPrices.length - 1].date.toISOString().split('T')[0],
                    price: lastPrice
                },
                min: Math.min(...prices),
                max: Math.max(...prices),
                change: Math.round((lastPrice - firstPrice) * 100) / 100,
                changePercent: Math.round(((lastPrice - firstPrice) / firstPrice) * 10000) / 100
            };
        } else {
            summary.priceRange = null;
        }

        res.json({
            summary,
            data: stockPrices.map(record => ({
                date: record.date.toISOString().split('T')[0],
                close: record.close
            }))
        });
    } catch (error) {
        console.error('Stock history API error:', error);
        res.status(500).json({ error: 'Failed to retrieve stock history' });
    } finally {
        await prisma.$disconnect();
    }
};