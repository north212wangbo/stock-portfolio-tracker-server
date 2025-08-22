const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

const getUserPortfoliosHandler = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const userId = req.user.id;

    try {
        // Get user's portfolios with basic transaction stats
        const portfolios = await prisma.portfolio.findMany({
            where: { userId },
            include: {
                transactions: {
                    select: {
                        id: true,
                        symbol: true,
                        type: true,
                        price: true,
                        shares: true,
                        timestamp: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        // Calculate summary stats for each portfolio
        const portfoliosWithStats = portfolios.map(portfolio => {
            let totalBuyValue = 0;
            let totalSellValue = 0;
            let totalShares = {};
            let uniqueSymbols = new Set();
            let lastTransactionDate = null;

            portfolio.transactions.forEach(transaction => {
                const { symbol, type, price, shares, timestamp } = transaction;
                
                uniqueSymbols.add(symbol);
                
                if (type === 'BUY') {
                    totalBuyValue += price * shares;
                    totalShares[symbol] = (totalShares[symbol] || 0) + shares;
                } else if (type === 'SELL') {
                    totalSellValue += price * shares;
                    totalShares[symbol] = (totalShares[symbol] || 0) - shares;
                }

                // Track most recent transaction
                if (!lastTransactionDate || new Date(timestamp) > new Date(lastTransactionDate)) {
                    lastTransactionDate = timestamp;
                }
            });

            // Count current holdings (shares > 0)
            const currentHoldingsCount = Object.values(totalShares)
                .filter(shares => shares > 0).length;

            const stats = {
                totalTransactions: portfolio.transactions.length,
                totalBuyValue: Math.round(totalBuyValue * 100) / 100,
                totalSellValue: Math.round(totalSellValue * 100) / 100,
                netInvestment: Math.round((totalBuyValue - totalSellValue) * 100) / 100,
                uniqueSymbols: uniqueSymbols.size,
                currentHoldingsCount,
                lastTransactionDate,
                isEmpty: portfolio.transactions.length === 0
            };

            // Add cached values if they exist
            if (portfolio.cachedGainLoss !== null) {
                stats.cachedGainLoss = portfolio.cachedGainLoss;
            }
            
            if (portfolio.cachedTotalValue !== null) {
                stats.cachedTotalValue = portfolio.cachedTotalValue;
            }

            return {
                id: portfolio.id,
                name: portfolio.name,
                created_at: portfolio.created_at,
                updated_at: portfolio.updated_at,
                stats
            };
        });

        // Overall user stats
        const totalPortfolios = portfolios.length;
        const totalTransactions = portfolios.reduce((sum, p) => sum + p.transactions.length, 0);
        const totalNetInvestment = portfoliosWithStats.reduce((sum, p) => sum + p.stats.netInvestment, 0);

        res.status(200).json({
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name
            },
            summary: {
                totalPortfolios,
                totalTransactions,
                totalNetInvestment: Math.round(totalNetInvestment * 100) / 100,
                emptyPortfolios: portfoliosWithStats.filter(p => p.stats.isEmpty).length,
                activePortfolios: portfoliosWithStats.filter(p => !p.stats.isEmpty).length
            },
            portfolios: portfoliosWithStats
        });
    } catch (error) {
        console.error('Get user portfolios error:', error);
        res.status(500).json({ error: 'Failed to retrieve portfolios' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(getUserPortfoliosHandler);