const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Configurable transaction limit per portfolio
const MAX_TRANSACTIONS_PER_PORTFOLIO = parseInt(process.env.MAX_TRANSACTIONS_PER_PORTFOLIO) || 200;

const bulkCreateTransactionsHandler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { transactions, portfolioId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ 
            error: 'Transactions array is required and cannot be empty' 
        });
    }

    if (!portfolioId) {
        return res.status(400).json({ error: 'portfolioId is required' });
    }

    // Validate each transaction
    const validationErrors = [];
    transactions.forEach((transaction, index) => {
        const { symbol, price, type, shares, timestamp } = transaction;

        if (!symbol || typeof symbol !== 'string' || symbol.trim().length === 0) {
            validationErrors.push(`Transaction ${index}: symbol is required and must be a non-empty string`);
        }

        if (!price || isNaN(price) || price <= 0) {
            validationErrors.push(`Transaction ${index}: price must be a positive number`);
        }

        if (!type || !['BUY', 'SELL'].includes(type.toUpperCase())) {
            validationErrors.push(`Transaction ${index}: type must be either BUY or SELL`);
        }

        if (!shares || isNaN(shares) || shares <= 0) {
            validationErrors.push(`Transaction ${index}: shares must be a positive number`);
        }

        if (timestamp && isNaN(new Date(timestamp).getTime())) {
            validationErrors.push(`Transaction ${index}: invalid timestamp format`);
        }
    });

    if (validationErrors.length > 0) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: validationErrors 
        });
    }

    try {
        // Check if portfolio exists and belongs to the authenticated user
        const portfolio = await prisma.portfolio.findUnique({
            where: { id: portfolioId },
            include: { user: true }
        });

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (portfolio.userId !== userId) {
            return res.status(403).json({ 
                error: 'You do not have permission to modify this portfolio' 
            });
        }

        // Check current transaction count in portfolio
        const currentCount = await prisma.transaction.count({
            where: {
                portfolios: {
                    some: { id: portfolioId }
                }
            }
        });

        if (currentCount + transactions.length > MAX_TRANSACTIONS_PER_PORTFOLIO) {
            return res.status(400).json({ 
                error: `Adding ${transactions.length} transactions would exceed the limit of ${MAX_TRANSACTIONS_PER_PORTFOLIO} transactions per portfolio`,
                limit: MAX_TRANSACTIONS_PER_PORTFOLIO,
                current: currentCount,
                attempting: transactions.length,
                available: MAX_TRANSACTIONS_PER_PORTFOLIO - currentCount
            });
        }

        // Use Prisma transaction for atomic operation (all or nothing)
        const result = await prisma.$transaction(async (tx) => {
            const createdTransactions = [];

            // Create each transaction
            for (const transactionData of transactions) {
                const { symbol, price, type, shares, timestamp } = transactionData;

                const createData = {
                    symbol: symbol.toUpperCase().trim(),
                    price: parseFloat(price),
                    type: type.toUpperCase(),
                    shares: parseFloat(shares),
                    portfolios: {
                        connect: { id: portfolioId }
                    }
                };

                // Add timestamp if provided
                if (timestamp) {
                    createData.timestamp = new Date(timestamp);
                }

                const createdTransaction = await tx.transaction.create({
                    data: createData,
                    include: {
                        portfolios: {
                            select: { id: true, name: true }
                        }
                    }
                });

                createdTransactions.push(createdTransaction);
            }

            return createdTransactions;
        });

        // Calculate summary statistics
        const summary = {
            totalTransactions: result.length,
            totalBuyTransactions: result.filter(t => t.type === 'BUY').length,
            totalSellTransactions: result.filter(t => t.type === 'SELL').length,
            totalBuyValue: result
                .filter(t => t.type === 'BUY')
                .reduce((sum, t) => sum + (t.price * t.shares), 0),
            totalSellValue: result
                .filter(t => t.type === 'SELL')
                .reduce((sum, t) => sum + (t.price * t.shares), 0),
            uniqueSymbols: [...new Set(result.map(t => t.symbol))].length
        };

        res.status(201).json({
            message: 'All transactions created and linked to portfolio successfully',
            portfolioId,
            portfolioName: portfolio.name,
            summary: {
                ...summary,
                totalBuyValue: Math.round(summary.totalBuyValue * 100) / 100,
                totalSellValue: Math.round(summary.totalSellValue * 100) / 100,
                netValue: Math.round((summary.totalBuyValue - summary.totalSellValue) * 100) / 100
            },
            transactions: result.map(transaction => ({
                id: transaction.id,
                symbol: transaction.symbol,
                price: transaction.price,
                type: transaction.type,
                shares: transaction.shares,
                value: Math.round(transaction.price * transaction.shares * 100) / 100,
                timestamp: transaction.timestamp,
                created_at: transaction.created_at
            }))
        });
    } catch (error) {
        console.error('Bulk create transactions error:', error);
        
        // Check if it's a Prisma transaction rollback
        if (error.code && error.code.startsWith('P')) {
            return res.status(400).json({ 
                error: 'Database constraint violation - operation rolled back',
                details: error.message 
            });
        }
        
        res.status(500).json({ error: 'Failed to create transactions - no transactions were saved' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(bulkCreateTransactionsHandler);