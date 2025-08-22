const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

module.exports = withAuth(async (req, res) => {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { portfolioId } = req.query;

    if (!portfolioId) {
        return res.status(400).json({ error: 'Portfolio ID is required' });
    }

    try {
        // First verify the portfolio belongs to the authenticated user
        const portfolio = await prisma.portfolio.findFirst({
            where: {
                id: portfolioId,
                userId: req.user.id
            }
        });

        if (!portfolio) {
            return res.status(404).json({ error: 'Portfolio not found or access denied' });
        }

        // Delete portfolio - Prisma will automatically handle the many-to-many cleanup
        // The transactions themselves won't be deleted, only the portfolio-transaction relationships
        await prisma.portfolio.delete({
            where: { id: portfolioId }
        });

        res.status(200).json({
            message: 'Portfolio deleted successfully',
            portfolioId: portfolioId
        });
    } catch (error) {
        console.error('Delete portfolio error:', error);
        res.status(500).json({ error: 'Failed to delete portfolio' });
    } finally {
        await prisma.$disconnect();
    }
});