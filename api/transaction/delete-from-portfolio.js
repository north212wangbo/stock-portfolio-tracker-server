const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

const deleteTransactionFromPortfolioHandler = async (req, res) => {
    if (req.method !== 'DELETE') {
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

        // Check if transaction exists and is linked to this portfolio
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { 
                portfolios: {
                    select: { id: true, name: true }
                }
            }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Check if transaction is actually linked to this portfolio
        const isLinked = transaction.portfolios.some(p => p.id === portfolioId);
        if (!isLinked) {
            return res.status(404).json({ 
                error: 'Transaction is not linked to this portfolio' 
            });
        }

        // Remove the transaction from this portfolio
        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                portfolios: {
                    disconnect: { id: portfolioId }
                }
            }
        });

        // Check if this was the last portfolio the transaction was linked to
        const updatedTransaction = await prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { 
                portfolios: {
                    select: { id: true }
                }
            }
        });

        let wasTransactionDeleted = false;

        // If no portfolios are linked to this transaction, delete the transaction permanently
        if (updatedTransaction && updatedTransaction.portfolios.length === 0) {
            await prisma.transaction.delete({
                where: { id: transactionId }
            });
            wasTransactionDeleted = true;
        }

        res.status(200).json({
            message: wasTransactionDeleted 
                ? 'Transaction removed from portfolio and deleted permanently (was not linked to any other portfolios)'
                : 'Transaction removed from portfolio successfully',
            transactionId,
            portfolioId,
            portfolioName: portfolio.name,
            transactionDeleted: wasTransactionDeleted,
            remainingPortfolios: wasTransactionDeleted ? 0 : updatedTransaction.portfolios.length
        });
    } catch (error) {
        console.error('Delete transaction from portfolio error:', error);
        res.status(500).json({ error: 'Failed to remove transaction from portfolio' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(deleteTransactionFromPortfolioHandler);