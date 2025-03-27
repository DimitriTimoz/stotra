import React, { useEffect, useState } from "react";
import axios from "axios";
import {
	Box,
	Heading,
	Table,
	Tag,
	Tbody,
	Td,
	Text,
	Th,
	Thead,
	Tr,
	useTheme,
	SimpleGrid,
	Stat,
	StatLabel,
	StatNumber,
	StatHelpText,
} from "@chakra-ui/react";

interface LeaderboardUser {
	username: string;
	value: number;
	initialInvestment?: number; // Optionnel car nous allons forcer sa valeur
	firstTransactionDate?: number;
}

// Formatting functions for currency and percentage
const format = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
}).format;

const formatPercent = new Intl.NumberFormat("en-US", {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
}).format;

// Constante pour l'investissement initial par utilisateur
const INITIAL_INVESTMENT_PER_USER = 10000;

function Leaderboard() {
	const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	let accentColor =
		useTheme()["components"]["Link"]["baseStyle"]["color"].split(".")[0];

	// Fetch leaderboard data
	useEffect(() => {
		setIsLoading(true);
		axios
			.get("/api/user/leaderboard")
			.then((res) => {
				setLeaderboard(res.data.users);
				setIsLoading(false);
			})
			.catch((err) => {
				console.error("Error fetching leaderboard:", err);
				setIsLoading(false);
			});
	}, []);

	// Calculate totals and statistics
	const totalUsers = leaderboard.length;
	const totalValue = leaderboard.reduce((sum, user) => sum + user.value, 0);
	
	// Utilisez la constante plutôt que les données potentiellement incorrectes
	const totalInitialInvestment = totalUsers * INITIAL_INVESTMENT_PER_USER;
	
	const totalReturn = totalInitialInvestment > 0 
		? ((totalValue - totalInitialInvestment) / totalInitialInvestment) 
		: 0;

	// Calculate user's return percentage
	const calculateUserReturn = (user: LeaderboardUser) => {
		// Toujours utiliser la constante pour l'investissement initial
		return (user.value - INITIAL_INVESTMENT_PER_USER) / INITIAL_INVESTMENT_PER_USER;
	};

	// Render user's return percentage
	const renderUserReturn = (user: LeaderboardUser) => {
		const userReturn = calculateUserReturn(user);
		
		return (
			<Text color={userReturn >= 0 ? "green.500" : "red.500"}>
				{formatPercent(userReturn)}
			</Text>
		);
	};

	return (
		<Box className="leaderboard">
			<Heading size="lg" mb={6}>
				Leaderboard
			</Heading>
			
			<SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
				<Stat
					px={4}
					py={3}
					bg="white"
					shadow="base"
					rounded="lg"
				>
					<StatLabel>Total Users</StatLabel>
					<StatNumber>{totalUsers}</StatNumber>
					<StatHelpText>Active traders</StatHelpText>
				</Stat>
				<Stat
					px={4}
					py={3}
					bg="white"
					shadow="base"
					rounded="lg"
				>
					<StatLabel>Total Portfolio Value</StatLabel>
					<StatNumber>{format(totalValue)}</StatNumber>
					<StatHelpText>Combined value</StatHelpText>
				</Stat>
				<Stat
					px={4}
					py={3}
					bg="white"
					shadow="base"
					rounded="lg"
				>
					<StatLabel>Total Return</StatLabel>
					<StatNumber color={totalReturn >= 0 ? "green.500" : "red.500"}>
						{formatPercent(totalReturn)}
					</StatNumber>
					<StatHelpText>vs initial investment</StatHelpText>
				</Stat>
			</SimpleGrid>

			<Table variant="simple" colorScheme="gray">
				<Thead>
					<Tr>
						<Th p={{ base: 2, md: 4 }}>Rank</Th>
						<Th p={{ base: 2, md: 4 }}>Username</Th>
						<Th p={{ base: 2, md: 4 }}>Portfolio Value</Th>
						<Th p={{ base: 2, md: 4 }}>Return</Th>
					</Tr>
				</Thead>
				<Tbody>
					{leaderboard.map((user, index) => (
						<Tr key={index}>
							<Td p={{ base: 2, md: 4 }}>
								<Tag colorScheme={index === 0 ? accentColor : "white"}>
									#{index + 1}
								</Tag>
							</Td>
							<Td
								p={{ base: 2, md: 4 }}
								overflow="hidden"
								textOverflow="ellipsis"
								whiteSpace="nowrap"
								maxW={5}
							>
								{user.username}
							</Td>
							<Td p={{ base: 2, md: 4 }}>{format(user.value)}</Td>
							<Td p={{ base: 2, md: 4 }}>
								{renderUserReturn(user)}
							</Td>
						</Tr>
					))}
				</Tbody>
			</Table>
			<Text mt={4} fontSize="sm" color="gray.500">
				The leaderboard is updated every few minutes.
			</Text>
		</Box>
	);
}

export default Leaderboard;
