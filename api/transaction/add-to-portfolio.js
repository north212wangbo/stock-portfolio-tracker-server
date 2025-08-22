const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Configurable transaction limit per portfolio
const MAX_TRANSACTIONS_PER_PORTFOLIO = parseInt(process.env.MAX_TRANSACTIONS_PER_PORTFOLIO) || 200;

const addTransactionToPortfolioHandler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { transactionId, portfolioId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!transactionId || !portfolioId) {
        return res.status(400).json({ 
            error: 'Both transactionId and portfolioId are required' 
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

        // Check if transaction exists
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Check if transaction is already linked to this portfolio
        const existingLink = await prisma.transaction.findFirst({
            where: {
                id: transactionId,
                portfolios: {
                    some: { id: portfolioId }
                }
            }
        });

        if (existingLink) {
            return res.status(409).json({ 
                error: 'Transaction is already linked to this portfolio' 
            });
        }

        // Check transaction count in portfolio
        const transactionCount = await prisma.transaction.count({
            where: {
                portfolios: {
                    some: { id: portfolioId }
                }
            }
        });

        if (transactionCount >= MAX_TRANSACTIONS_PER_PORTFOLIO) {
            return res.status(400).json({ 
                error: `Maximum of ${MAX_TRANSACTIONS_PER_PORTFOLIO} transactions allowed per portfolio`,
                limit: MAX_TRANSACTIONS_PER_PORTFOLIO,
                current: transactionCount
            });
        }

        // Link transaction to portfolio
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                portfolios: {
                    connect: { id: portfolioId }
                }
            }
        });

        res.status(200).json({
            message: 'Transaction successfully added to portfolio',
            transactionId,
            portfolioId,
            portfolioName: portfolio.name
        });
    } catch (error) {
        console.error('Add transaction to portfolio error:', error);
        res.status(500).json({ error: 'Failed to add transaction to portfolio' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(addTransactionToPortfolioHandler);