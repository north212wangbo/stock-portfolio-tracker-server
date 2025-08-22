const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

const updatePortfolioHandler = async (req, res) => {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { portfolioId } = req.query;
    const { name, cachedGainLoss, cachedTotalValue } = req.body;
    const userId = req.user.id;

    // Validate required parameters
    if (!portfolioId) {
        return res.status(400).json({ error: 'portfolioId is required' });
    }

    // Check if at least one field is provided for update
    if (name === undefined && cachedGainLoss === undefined && cachedTotalValue === undefined) {
        return res.status(400).json({ 
            error: 'At least one field must be provided: name, cachedGainLoss, or cachedTotalValue' 
        });
    }

    try {
        // Check if portfolio exists and belongs to the authenticated user
        const existingPortfolio = await prisma.portfolio.findUnique({
            where: { id: portfolioId },
            include: { user: true }
        });

        if (!existingPortfolio) {
            return res.status(404).json({ error: 'Portfolio not found' });
        }

        if (existingPortfolio.userId !== userId) {
            return res.status(403).json({ 
                error: 'You do not have permission to update this portfolio' 
            });
        }

        // Build update data object with only provided fields
        const updateData = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim() === '') {
                return res.status(400).json({ error: 'Name must be a non-empty string' });
            }
            
            if (name.length > 100) {
                return res.status(400).json({ error: 'Name must be less than 100 characters' });
            }

            // Check if name conflicts with existing portfolio (only if name is being changed)
            if (name.trim() !== existingPortfolio.name) {
                const nameConflict = await prisma.portfolio.findFirst({
                    where: {
                        userId,
                        name: name.trim(),
                        id: { not: portfolioId } // Exclude current portfolio
                    }
                });

                if (nameConflict) {
                    return res.status(409).json({ 
                        error: 'Portfolio with this name already exists' 
                    });
                }
            }

            updateData.name = name.trim();
        }

        if (cachedGainLoss !== undefined) {
            if (typeof cachedGainLoss !== 'number' && cachedGainLoss !== null) {
                return res.status(400).json({ error: 'cachedGainLoss must be a number or null' });
            }
            updateData.cachedGainLoss = cachedGainLoss;
        }

        if (cachedTotalValue !== undefined) {
            if (typeof cachedTotalValue !== 'number' && cachedTotalValue !== null) {
                return res.status(400).json({ error: 'cachedTotalValue must be a number or null' });
            }
            updateData.cachedTotalValue = cachedTotalValue;
        }

        // Update the portfolio
        const updatedPortfolio = await prisma.portfolio.update({
            where: { id: portfolioId },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        res.status(200).json({
            message: 'Portfolio updated successfully',
            portfolio: {
                id: updatedPortfolio.id,
                name: updatedPortfolio.name,
                cachedGainLoss: updatedPortfolio.cachedGainLoss,
                cachedTotalValue: updatedPortfolio.cachedTotalValue,
                userId: updatedPortfolio.userId,
                created_at: updatedPortfolio.created_at,
                updated_at: updatedPortfolio.updated_at,
                user: updatedPortfolio.user
            }
        });
    } catch (error) {
        console.error('Update portfolio error:', error);
        
        if (error.code === 'P2002') {
            return res.status(409).json({ 
                error: 'Portfolio with this name already exists' 
            });
        }
        
        res.status(500).json({ error: 'Failed to update portfolio' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(updatePortfolioHandler);