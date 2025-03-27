import { Request, Response } from "express";
import User from "../models/user.model";
import { fetchStockData } from "../utils/requests";

import dotenv from "dotenv";
dotenv.config();
const leaderboardCacheTTL = parseInt(process.env.STOTRA_LEADERBOARD_CACHE_TTL || "600");

import NodeCache from "node-cache";
const cache = new NodeCache({ stdTTL: leaderboardCacheTTL });

const getLeaderboard = (req: Request, res: Response) => {
	/* 
	#swagger.tags = ['Leaderboard']
	*/
	if (cache.has("leaderboard")) {
		const leaderboard = cache.get("leaderboard");
		res.status(200).send({ users: leaderboard });
		return;
	}

	getLeaderboardTopN(-1)
		.then((users) => {
			cache.set("leaderboard", users);
			res.status(200).send({ users });
		})
		.catch((err: { message: any }) => {
			res.status(500).send({ message: err.message });
		});
};

export async function getLeaderboardTopN(
	n: number,
): Promise<{ username: string; value: number; firstTransactionDate?: number; initialInvestment?: number }[]> {
	// 1. Collate all unique stock symbols from users' positions using Aggregation
	const symbolsAggregation = await User.aggregate([
		{ $unwind: "$positions" },
		{ $group: { _id: "$positions.symbol" } },
	]);
	const uniqueSymbols: string[] = symbolsAggregation.map((entry) => entry._id);

	// 2. Fetch stock prices in batches of 100 with 55ms delay between them
	const stockPrices: { [key: string]: number } = {};
	async function fetchStockPricesInBatches() {
		for (let i = 0; i < uniqueSymbols.length; i += 100) {
			const batch = uniqueSymbols.slice(i, i + 100);
			const dataPoints = await Promise.all(batch.map((symbol) => fetchStockData(symbol)));

			dataPoints.forEach((dataPoint) => {
				stockPrices[dataPoint.symbol] = dataPoint.regularMarketPrice;
			});

			// Wait 55ms before fetching the next batch, except for the last batch
			if (i + 100 < uniqueSymbols.length) {
				await new Promise((resolve) => setTimeout(resolve, 55));
			}
		}
	}
	await fetchStockPricesInBatches();

	// 3. Compute portfolio values for each user using projection and get first transaction date
	interface Position {
		symbol: string;
		quantity: number;
	}

	interface UserWithPositions {
		username: string;
		positions: Position[];
		cash: number;
		firstTransactionDate?: number;
		initialInvestment?: number;
	}

	const userValues: { username: string; value: number; firstTransactionDate?: number; initialInvestment?: number }[] = [];

	// First get users with their transactions
	const usersWithTransactions = await User.aggregate([
		{
			$project: {
				username: 1,
				positions: 1,
				cash: 1,
				firstTransactionDate: { 
					$cond: {
						if: { $gt: [{ $size: "$positions" }, 0] },
						then: { $min: "$positions.purchaseDate" },
						else: "$$REMOVE"
					}
				},
				// Calculate initialInvestment from positions
				initialInvestment: {
					$add: [
						100000,  // Initial cash amount
						{
							$reduce: {
								input: "$positions",
								initialValue: 0,
								in: {
									$add: [
										"$$value",
										{ $multiply: ["$$this.purchasePrice", "$$this.quantity"] }
									]
								}
							}
						}
					]
				}
			}
		}
	]);

	// Debug log to check the MongoDB query
	console.log("MongoDB Query:", JSON.stringify(usersWithTransactions, null, 2));

	// Add more specific debug logs
	console.log("Debug aggregation results:", usersWithTransactions.map(user => ({
		username: user.username,
		positionCount: user.positions?.length || 0,
		firstTransactionDate: user.firstTransactionDate,
		hasPositions: user.positions?.length > 0,
		samplePosition: user.positions?.[0]
	})));

	usersWithTransactions.forEach((user) => {
		let totalValue = user.cash;
		user.positions.forEach((position: Position) => {
			const currentPrice = stockPrices[position.symbol];
			totalValue += currentPrice * position.quantity;
		});
		
		const userData = { 
			username: user.username, 
			value: totalValue,
			firstTransactionDate: user.firstTransactionDate,
			initialInvestment: user.initialInvestment
		};

		console.log(`User ${user.username} portfolio data:`, {
			value: totalValue,
			firstTransactionDate: user.firstTransactionDate ? new Date(user.firstTransactionDate) : 'none'
		});

		userValues.push(userData);
	});

	// Sort by portfolio value
	userValues.sort((a, b) => b.value - a.value);

	return userValues;
}

export default { getLeaderboard };
