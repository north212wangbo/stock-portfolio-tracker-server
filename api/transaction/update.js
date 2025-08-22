const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

module.exports = withAuth(async (req, res) => {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { transactionId } = req.query;
    const { symbol, price, type, shares, timestamp } = req.body;

    if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
    }

    try {
        // First verify the transaction belongs to one of the user's portfolios
        const transaction = await prisma.transaction.findFirst({
            where: {
                id: transactionId,
                portfolios: {
                    some: {
                        userId: req.user.id
                    }
                }
            }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found or access denied' });
        }

        // Build update data object with only provided fields
        const updateData = {};
        if (symbol !== undefined) updateData.symbol = symbol;
        if (price !== undefined) updateData.price = price;
        if (type !== undefined) updateData.type = type;
        if (shares !== undefined) updateData.shares = shares;
        if (timestamp !== undefined) updateData.timestamp = new Date(timestamp);

        // Validate required fields if provided
        if (updateData.price !== undefined && (typeof updateData.price !== 'number' || updateData.price <= 0)) {
            return res.status(400).json({ error: 'Price must be a positive number' });
        }

        if (updateData.shares !== undefined && (typeof updateData.shares !== 'number' || updateData.shares <= 0)) {
            return res.status(400).json({ error: 'Shares must be a positive number' });
        }

        if (updateData.type !== undefined && !['BUY', 'SELL'].includes(updateData.type)) {
            return res.status(400).json({ error: 'Type must be either BUY or SELL' });
        }

        if (updateData.symbol !== undefined && (!updateData.symbol || updateData.symbol.trim() === '')) {
            return res.status(400).json({ error: 'Symbol cannot be empty' });
        }

        // Update the transaction
        const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: updateData
        });

        res.status(200).json({
            message: 'Transaction updated successfully',
            transaction: updatedTransaction
        });
    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    } finally {
        await prisma.$disconnect();
    }
});