const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

const createTransactionHandler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { symbol, price, type, shares, timestamp } = req.body;

    // Validate required fields
    if (!symbol || !price || !type || !shares) {
        return res.status(400).json({ 
            error: 'Missing required fields: symbol, price, type, shares' 
        });
    }

    // Validate type
    if (!['BUY', 'SELL'].includes(type.toUpperCase())) {
        return res.status(400).json({ 
            error: 'Type must be either BUY or SELL' 
        });
    }

    // Validate numeric fields
    if (isNaN(price) || price <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number' });
    }

    if (isNaN(shares) || shares <= 0) {
        return res.status(400).json({ error: 'Shares must be a positive number' });
    }

    // Validate symbol format
    if (typeof symbol !== 'string' || symbol.trim().length === 0) {
        return res.status(400).json({ error: 'Symbol must be a non-empty string' });
    }

    try {
        const transactionData = {
            symbol: symbol.toUpperCase().trim(),
            price: parseFloat(price),
            type: type.toUpperCase(),
            shares: parseFloat(shares)
        };

        // Add timestamp if provided
        if (timestamp) {
            const parsedTimestamp = new Date(timestamp);
            if (isNaN(parsedTimestamp.getTime())) {
                return res.status(400).json({ error: 'Invalid timestamp format' });
            }
            transactionData.timestamp = parsedTimestamp;
        }

        const transaction = await prisma.transaction.create({
            data: transactionData
        });

        res.status(201).json({
            message: 'Transaction created successfully',
            transactionId: transaction.id,
            transaction: {
                id: transaction.id,
                symbol: transaction.symbol,
                price: transaction.price,
                type: transaction.type,
                shares: transaction.shares,
                timestamp: transaction.timestamp,
                created_at: transaction.created_at
            }
        });
    } catch (error) {
        console.error('Transaction creation error:', error);
        res.status(500).json({ error: 'Failed to create transaction' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(createTransactionHandler);