const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

const getPortfolioTransactionsHandler = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { portfolioId } = req.query;
    const userId = req.user.id;

    // Validate required fields
    if (!portfolioId) {
        return res.status(400).json({ error: 'portfolioId is required' });
    }

    try {
        // Check if portfolio exists and belongs to the authenticated user
        const portfolio = await prisma.portfolio.findUnique({
            where: { id: portfolioId },
            include: { 
                user: true,
                transactions: {
                    orderBy: { timestamp: 'desc' } // Most recent transactions first
                }
            }
        });

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (portfolio.userId !== userId) {
            return res.status(403).json({ 
                error: 'You do not have permission to view this portfolio' 
            });
        }

        // Calculate portfolio summary stats and holdings history
        let totalBuyValue = 0;
        let totalSellValue = 0;
        let totalShares = {};
        let allTimeShares = {}; // Track all symbols ever held

        portfolio.transactions.forEach(transaction => {
            const { symbol, type, price, shares } = transaction;
            
            // Initialize if first time seeing this symbol
            if (!allTimeShares[symbol]) {
                allTimeShares[symbol] = {
                    symbol,
                    totalBought: 0,
                    totalSold: 0,
                    currentShares: 0,
                    totalBuyValue: 0,
                    totalSellValue: 0,
                    averageBuyPrice: 0,
                    averageSellPrice: 0,
                    firstTransactionDate: transaction.timestamp,
                    lastTransactionDate: transaction.timestamp,
                    transactionCount: 0
                };
            }
            
            const holding = allTimeShares[symbol];
            holding.transactionCount++;
            holding.lastTransactionDate = transaction.timestamp;
            
            if (type === 'BUY') {
                totalBuyValue += price * shares;
                totalShares[symbol] = (totalShares[symbol] || 0) + shares;
                
                holding.totalBought += shares;
                holding.currentShares += shares;
                holding.totalBuyValue += price * shares;
                holding.averageBuyPrice = holding.totalBought > 0 ? holding.totalBuyValue / holding.totalBought : 0;
            } else if (type === 'SELL') {
                totalSellValue += price * shares;
                totalShares[symbol] = (totalShares[symbol] || 0) - shares;
                
                holding.totalSold += shares;
                holding.currentShares -= shares;
                holding.totalSellValue += price * shares;
                holding.averageSellPrice = holding.totalSold > 0 ? holding.totalSellValue / holding.totalSold : 0;
            }
        });

        // Get unique symbols in the portfolio
        const symbols = [...new Set(portfolio.transactions.map(t => t.symbol))];

        res.status(200).json({
            portfolio: {
                id: portfolio.id,
                name: portfolio.name,
                userId: portfolio.userId
            },
            summary: {
                totalTransactions: portfolio.transactions.length,
                totalBuyValue: Math.round(totalBuyValue * 100) / 100,
                totalSellValue: Math.round(totalSellValue * 100) / 100,
                netInvestment: Math.round((totalBuyValue - totalSellValue) * 100) / 100,
                uniqueSymbols: symbols.length,
                currentHoldingsCount: Object.values(totalShares).filter(shares => shares > 0).length,
                allTimeHoldingsCount: Object.keys(allTimeShares).length
            },
            holdings: Object.values(allTimeShares).map(holding => ({
                symbol: holding.symbol,
                totalBought: Math.round(holding.totalBought * 100) / 100,
                totalSold: Math.round(holding.totalSold * 100) / 100,
                currentShares: Math.round(holding.currentShares * 100) / 100,
                totalBuyValue: Math.round(holding.totalBuyValue * 100) / 100,
                totalSellValue: Math.round(holding.totalSellValue * 100) / 100,
                averageBuyPrice: Math.round(holding.averageBuyPrice * 100) / 100,
                averageSellPrice: Math.round(holding.averageSellPrice * 100) / 100,
                netShares: Math.round((holding.totalBought - holding.totalSold) * 100) / 100,
                netValue: Math.round((holding.totalBuyValue - holding.totalSellValue) * 100) / 100,
                realizedPnL: Math.round((holding.totalSellValue - (holding.averageBuyPrice * holding.totalSold)) * 100) / 100,
                isCurrentlyHeld: holding.currentShares > 0,
                firstTransactionDate: holding.firstTransactionDate,
                lastTransactionDate: holding.lastTransactionDate,
                transactionCount: holding.transactionCount
            })).sort((a, b) => new Date(b.lastTransactionDate) - new Date(a.lastTransactionDate)),
            transactions: portfolio.transactions.map(transaction => ({
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
        console.error('Get portfolio transactions error:', error);
        res.status(500).json({ error: 'Failed to retrieve portfolio transactions' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(getPortfolioTransactionsHandler);