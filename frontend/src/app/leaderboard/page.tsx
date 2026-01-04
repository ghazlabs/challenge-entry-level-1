'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  createdAt: string;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

async function fetchLeaderboard(page: number): Promise<LeaderboardResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const response = await fetch(
    `${apiUrl}/api/leaderboard?page=${page}&limit=${PAGE_SIZE}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  return response.json();
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leaderboard', page],
    queryFn: () => fetchLeaderboard(page),
    staleTime: 30 * 1000, // 30 seconds
  });

  const entries = data?.entries ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  return (
    <main className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4'>
      <div className='max-w-2xl mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <Button
            onClick={() => router.push('/')}
            variant='ghost'
            className='text-gray-400 hover:text-white'
          >
            ← Back to Lobby
          </Button>
        </div>

        <div className='text-center mb-8'>
          <h1 className='text-4xl font-bold text-white mb-2'>🏆 Leaderboard</h1>
          <p className='text-gray-400'>Top Dino Runners</p>
        </div>

        <Card className='bg-gray-800/50 border-gray-700 backdrop-blur-sm'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-white'>High Scores</CardTitle>
              {totalCount > 0 && (
                <span className='text-gray-400 text-sm'>
                  {totalCount} total entries
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='flex items-center justify-center py-12'>
                <Spinner className='h-8 w-8 text-gray-400' />
              </div>
            ) : error ? (
              <div className='text-center py-12'>
                <p className='text-red-400 mb-4'>
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
                <Button
                  onClick={() => refetch()}
                  variant='outline'
                  className='border-gray-600 text-gray-300'
                >
                  Try Again
                </Button>
              </div>
            ) : entries.length === 0 ? (
              <div className='text-center py-12'>
                <p className='text-gray-400 text-lg mb-2'>No scores yet!</p>
                <p className='text-gray-500'>
                  Be the first to play and set a record.
                </p>
                <Button
                  onClick={() => router.push('/')}
                  className='mt-4 bg-gradient-to-r from-green-500 to-emerald-600'
                >
                  Play Now
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className='border-gray-700'>
                      <TableHead className='text-gray-400 w-16'>Rank</TableHead>
                      <TableHead className='text-gray-400'>Player</TableHead>
                      <TableHead className='text-gray-400 text-right'>
                        Score
                      </TableHead>
                      <TableHead className='text-gray-400 text-right'>
                        Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow
                        key={`${entry.playerId}-${entry.createdAt}`}
                        className='border-gray-700/50'
                      >
                        <TableCell className='font-medium text-white'>
                          {getRankEmoji(entry.rank)}
                        </TableCell>
                        <TableCell className='text-gray-300'>
                          {entry.playerName}
                        </TableCell>
                        <TableCell className='text-right text-white font-bold font-mono'>
                          {entry.score.toLocaleString()}
                        </TableCell>
                        <TableCell className='text-right text-gray-500 text-sm'>
                          {formatDate(entry.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className='flex items-center justify-between mt-6 pt-4 border-t border-gray-700'>
                    <Button
                      onClick={handlePrevPage}
                      disabled={page === 1}
                      variant='outline'
                      className='border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50'
                    >
                      ← Previous
                    </Button>
                    <span className='text-gray-400 text-sm'>
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      onClick={handleNextPage}
                      disabled={page === totalPages}
                      variant='outline'
                      className='border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50'
                    >
                      Next →
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Play Button */}
        {!isLoading && !error && (
          <div className='mt-6 text-center'>
            <Button
              onClick={() => router.push('/')}
              className='bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
            >
              🎮 Play Now
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
