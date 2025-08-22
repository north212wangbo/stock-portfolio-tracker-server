const { PrismaClient } = require('@prisma/client');
const { withAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Configurable portfolio limit
const MAX_PORTFOLIOS_PER_USER = parseInt(process.env.MAX_PORTFOLIOS_PER_USER) || 5;

const createPortfolioHandler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Portfolio name is required' });
    }

    if (name.length > 100) {
        return res.status(400).json({ error: 'Portfolio name must be less than 100 characters' });
    }

    try {
        // Check current portfolio count for the user
        const portfolioCount = await prisma.portfolio.count({
            where: { userId }
        });

        if (portfolioCount >= MAX_PORTFOLIOS_PER_USER) {
            return res.status(400).json({ 
                error: `Maximum of ${MAX_PORTFOLIOS_PER_USER} portfolios allowed per user`,
                limit: MAX_PORTFOLIOS_PER_USER,
                current: portfolioCount
            });
        }

        const portfolio = await prisma.portfolio.create({
            data: {
                userId,
                name: name.trim()
            },
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

        res.status(201).json({
            message: 'Portfolio created successfully',
            portfolio: {
                id: portfolio.id,
                name: portfolio.name,
                userId: portfolio.userId,
                created_at: portfolio.created_at,
                updated_at: portfolio.updated_at,
                user: portfolio.user
            }
        });
    } catch (error) {
        console.error('Portfolio creation error:', error);
        
        if (error.code === 'P2002') {
            return res.status(409).json({ 
                error: 'Portfolio with this name already exists for this user' 
            });
        }
        
        res.status(500).json({ error: 'Failed to create portfolio' });
    } finally {
        await prisma.$disconnect();
    }
};

module.exports = withAuth(createPortfolioHandler);