const yahooFinance = require("yahoo-finance2").default;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MONTHS_TO_BACKFILL = 12; // Configurable backfill period

module.exports = async (req, res) => {
  console.log("Stock data update job started");
  await runStockUpdateJob();
  console.log("Stock data update job finished");

  res.status(200).json({ message: "Stock data update complete" });
};

function getAllMondays(startDate, endDate) {
  const mondays = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Start from the first Monday on or after startDate
  const current = new Date(start);
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() + 1);
  }

  // Collect all Mondays between start and end
  while (current <= end) {
    mondays.push(new Date(current));
    current.setDate(current.getDate() + 7); // Next Monday
  }

  return mondays;
}

function getBackfillStartDate() {
  const today = new Date();
  const backfillStart = new Date(today);
  backfillStart.setMonth(today.getMonth() - MONTHS_TO_BACKFILL);
  return backfillStart;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStockUpdateJob() {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const backfillStartDate = getBackfillStartDate();

  console.log(`Checking stocks for updates. Backfill cutoff: ${backfillStartDate.toISOString()}, Recent cutoff: ${sevenDaysAgo.toISOString()}`);

  // Get all stock symbols that need updates
  const stocksNeedingUpdate = await prisma.stockHistory.findMany({
    where: {
      OR: [
        { endDate: { lt: sevenDaysAgo } },      // End date is more than 7 days ago
        { startDate: { gt: backfillStartDate } } // Start date is less than X months ago
      ]
    }
  });

  console.log(`Found ${stocksNeedingUpdate.length} stocks needing updates`);

  for (const stockHistory of stocksNeedingUpdate) {
    const { symbol, startDate, endDate } = stockHistory;
    console.log(`Processing ${symbol}: start=${startDate.toISOString()}, end=${endDate.toISOString()}`);

    try {
      // Case 1: End date is more than 7 days ago - fetch recent data
      if (endDate < sevenDaysAgo) {
        console.log(`Fetching recent data for ${symbol}`);
        await fetchRecentData(symbol, endDate);
      }

      // Case 2: Start date is less than X months ago - backfill historical data
      if (startDate > backfillStartDate) {
        console.log(`Backfilling historical data for ${symbol}`);
        await backfillHistoricalData(symbol, backfillStartDate, startDate);
      }

    } catch (error) {
      console.error(`Error processing ${symbol}: ${error.message}`);
    }
  }

  console.log("Stock update job complete");
}

async function fetchRecentData(symbol, currentEndDate) {
  try {
    const today = new Date();
    
    // Find the next Monday after current end date
    const nextMondayAfterEnd = new Date(currentEndDate);
    nextMondayAfterEnd.setDate(nextMondayAfterEnd.getDate() + 1); // Day after end date
    while (nextMondayAfterEnd.getDay() !== 1) { // Find next Monday
      nextMondayAfterEnd.setDate(nextMondayAfterEnd.getDate() + 1);
    }

    // Get all Mondays from next Monday after end date to today
    const mondaysToFetch = getAllMondays(nextMondayAfterEnd, today);
    
    if (mondaysToFetch.length === 0) {
      console.log(`No Mondays to fetch for ${symbol} (end date: ${currentEndDate.toISOString()})`);
      return;
    }

    console.log(`Fetching recent data for ${symbol}: ${mondaysToFetch.length} Mondays from ${nextMondayAfterEnd.toISOString()} to today`);

    for (const monday of mondaysToFetch) {
      const isoDate = monday.toISOString().split("T")[0];

      // Check if we already have data for this date
      const exists = await prisma.stockprice.findFirst({
        where: {
          symbol: symbol.toUpperCase(),
          date: new Date(isoDate),
        },
      });

      if (exists) {
        console.log(`Data already exists for ${symbol} @ ${isoDate}, updating StockHistory endDate directly`);
        
        // Update StockHistory directly if this date extends the endDate range
        await prisma.stockHistory.updateMany({
          where: {
            symbol: symbol.toUpperCase(),
            endDate: { lt: new Date(isoDate) }
          },
          data: {
            endDate: new Date(isoDate)
          }
        });
        
        continue;
      }

      try {
        const nextDay = new Date(monday);
        nextDay.setDate(nextDay.getDate() + 1);

        const historical = await yahooFinance.historical(symbol, {
          period1: monday,
          period2: nextDay,
          interval: "1d",
        });

        const dayData = historical?.[0];
        if (dayData?.close) {
          await prisma.stockprice.upsert({
            where: {
              symbol_date: {
                symbol: symbol.toUpperCase(),
                date: new Date(isoDate),
              }
            },
            update: {
              close: dayData.close,
              change: dayData.change || null,
              percentChange: dayData.changePercent || null,
            },
            create: {
              symbol: symbol.toUpperCase(),
              date: new Date(isoDate),
              close: dayData.close,
              change: dayData.change || null,
              percentChange: dayData.changePercent || null,
            }
          });

          console.log(`Fetched recent data for ${symbol} @ ${isoDate} = ${dayData.close}`);
        } else {
          console.warn(`No recent data available for ${symbol} @ ${isoDate}, updating StockHistory endDate to mark as checked`);
          
          // Update StockHistory endDate even when no data exists to avoid re-fetching
          await prisma.stockHistory.updateMany({
            where: {
              symbol: symbol.toUpperCase(),
              endDate: { lt: new Date(isoDate) }
            },
            data: {
              endDate: new Date(isoDate)
            }
          });
        }

        await delay(300); // Rate limiting
      } catch (err) {
        console.error(`Error fetching recent data for ${symbol} @ ${isoDate}: ${err.message}`);
        console.log(`Skipping remaining dates for ${symbol} due to API error`);
        break; // Skip remaining dates for this symbol
      }
    }

    console.log(`Completed fetching recent data for ${symbol}`);
  } catch (error) {
    console.error(`Failed to fetch recent data for ${symbol}: ${error.message}`);
  }
}

async function backfillHistoricalData(symbol, backfillStart, currentStart) {
  try {
    // Get all Mondays between backfill start and current start date, but process in reverse order
    // Start from current start date and work backwards to backfill start
    const mondaysToBackfill = getAllMondays(backfillStart, currentStart).reverse();
    console.log(`Backfilling ${mondaysToBackfill.length} Mondays for ${symbol} (working backwards from current start)`);

    for (const monday of mondaysToBackfill) {
      const isoDate = monday.toISOString().split("T")[0];

      // Check if we already have data for this date
      const exists = await prisma.stockprice.findFirst({
        where: {
          symbol: symbol.toUpperCase(),
          date: new Date(isoDate),
        },
      });

      if (exists) {
        console.log(`Data already exists for ${symbol} @ ${isoDate}, updating StockHistory startDate directly`);
        
        // Update StockHistory directly if this date extends the startDate range
        await prisma.stockHistory.updateMany({
          where: {
            symbol: symbol.toUpperCase(),
            startDate: { gt: new Date(isoDate) }
          },
          data: {
            startDate: new Date(isoDate)
          }
        });
        
        continue;
      }

      try {
        const nextDay = new Date(monday);
        nextDay.setDate(nextDay.getDate() + 1);

        const historical = await yahooFinance.historical(symbol, {
          period1: monday,
          period2: nextDay,
          interval: "1d",
        });

        const dayData = historical?.[0];
        if (dayData?.close) {
          await prisma.stockprice.upsert({
            where: {
              symbol_date: {
                symbol: symbol.toUpperCase(),
                date: new Date(isoDate),
              }
            },
            update: {
              close: dayData.close,
              change: dayData.change || null,
              percentChange: dayData.changePercent || null,
            },
            create: {
              symbol: symbol.toUpperCase(),
              date: new Date(isoDate),
              close: dayData.close,
              change: dayData.change || null,
              percentChange: dayData.changePercent || null,
            }
          });

          console.log(`Backfilled ${symbol} @ ${isoDate} = ${dayData.close} (trigger will update startDate if earlier)`);
        } else {
          console.warn(`No historical data available for ${symbol} @ ${isoDate}, updating StockHistory startDate to mark as checked`);
          
          // Update StockHistory startDate even when no data exists to avoid re-fetching
          await prisma.stockHistory.updateMany({
            where: {
              symbol: symbol.toUpperCase(),
              startDate: { gt: new Date(isoDate) }
            },
            data: {
              startDate: new Date(isoDate)
            }
          });
        }

        await delay(300); // Rate limiting
      } catch (err) {
        console.error(`Error backfilling ${symbol} @ ${isoDate}: ${err.message}`);
        console.log(`Skipping remaining dates for ${symbol} due to API error`);
        break; // Skip remaining dates for this symbol
      }
    }
    
    console.log(`Completed backfill for ${symbol} - database trigger has automatically updated startDate`);
  } catch (error) {
    console.error(`Failed to backfill historical data for ${symbol}: ${error.message}`);
  }
}
