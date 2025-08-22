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
    
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { symbols, days, apiKey } = req.body;

    // Validate required parameters
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ 
            error: 'Symbols parameter is required and must be a non-empty array' 
        });
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

    // Validate symbols array
    if (symbols.length > 50) { // Limit to prevent timeout
        return res.status(400).json({ error: 'Cannot request more than 50 symbols at once' });
    }

    // Validate individual symbols
    const validSymbols = symbols.filter(symbol => 
        typeof symbol === 'string' && symbol.trim().length > 0
    );

    if (validSymbols.length === 0) {
        return res.status(400).json({ error: 'No valid symbols provided' });
    }

    try {
        // Calculate the cutoff date (now - number of days)
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (numberOfDays * 24 * 60 * 60 * 1000));

        // Query all symbols in a single database call
        const allStockPrices = await prisma.stockprice.findMany({
            where: {
                symbol: {
                    in: validSymbols.map(s => s.toUpperCase())
                },
                date: {
                    gte: cutoffDate
                }
            },
            orderBy: [
                { symbol: 'asc' },
                { date: 'asc' }
            ]
        });

        // Group results by symbol
        const resultsBySymbol = {};

        // Initialize empty results for all requested symbols
        validSymbols.forEach(symbol => {
            const upperSymbol = symbol.toUpperCase();
            resultsBySymbol[upperSymbol] = [];
        });

        // Group stock prices by symbol
        allStockPrices.forEach(record => {
            const symbol = record.symbol;
            resultsBySymbol[symbol].push({
                date: record.date.toISOString().split('T')[0],
                close: record.close
            });
        });

        res.json(resultsBySymbol);
    } catch (error) {
        console.error('Bulk stock history API error:', error);
        res.status(500).json({ error: 'Failed to retrieve stock history' });
    } finally {
        await prisma.$disconnect();
    }
};