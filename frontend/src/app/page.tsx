'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { GameStartPayload, getSocket } from '@/lib/socket';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function LobbyPage() {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');

  const handleGameStart = useCallback(
    (payload: unknown) => {
      const data = payload as GameStartPayload;
      // Store game data in sessionStorage for the game page
      sessionStorage.setItem('gameData', JSON.stringify(data));
      router.push('/game');
    },
    [router]
  );

  useEffect(() => {
    const socket = getSocket();

    const connect = async () => {
      try {
        await socket.connect();
        setIsConnected(true);
        setError(null);
      } catch {
        setError('Failed to connect to server.');
        setIsConnected(false);
      }
    };

    connect();

    socket.on('GAME_START', handleGameStart);

    return () => {
      socket.off('GAME_START', handleGameStart);
    };
  }, [handleGameStart]);

  const handleFindMatch = () => {
    const socket = getSocket();
    if (!socket.isConnected()) {
      setError('Not connected to server');
      return;
    }

    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }

    setIsSearching(true);
    setError(null);
    socket.joinQueue(trimmedName);
  };

  const handleCancel = () => {
    setIsSearching(false);
  };

  return (
    <main className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        {/* Logo / Title */}
        <div className='text-center mb-8'>
          <h1 className='text-5xl font-bold text-white mb-2 tracking-tight'>
            🦖 DINO Game
          </h1>
          <p className='text-gray-400 text-lg'>
            Multiplayer Race by Achieva Gemilang
          </p>
        </div>

        <Card className='bg-gray-800/50 border-gray-700 backdrop-blur-sm'>
          <CardHeader className='text-center'>
            <CardTitle className='text-white text-2xl'>1v1 Battle</CardTitle>
            <CardDescription className='text-gray-400'>
              Race against another player. Survive the longest to win!
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {error && (
              <div className='bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm'>
                {error}
              </div>
            )}

            {!isSearching ? (
              <div className='space-y-4'>
                {/* Name Input */}
                <div>
                  <label
                    htmlFor='playerName'
                    className='block text-sm font-medium text-gray-300 mb-2'
                  >
                    Enter your name
                  </label>
                  <Input
                    id='playerName'
                    type='text'
                    placeholder='Your display name'
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={20}
                    className='bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500'
                  />
                </div>
                <Button
                  onClick={handleFindMatch}
                  disabled={!isConnected}
                  className='w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0'
                >
                  {isConnected ? '🎮 Find Match' : 'Connecting...'}
                </Button>
              </div>
            ) : (
              <div className='text-center space-y-4'>
                <div className='flex items-center justify-center gap-3 text-white'>
                  <Spinner className='h-6 w-6' />
                  <span className='text-lg'>Searching for opponent...</span>
                </div>
                <Button
                  onClick={handleCancel}
                  variant='outline'
                  className='border-gray-600 text-gray-300 hover:bg-gray-700'
                >
                  Cancel
                </Button>
              </div>
            )}

            <div className='flex items-center gap-2 justify-center text-gray-500 text-sm'>
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {isConnected ? 'Connected to server' : 'Disconnected'}
            </div>
          </CardContent>
        </Card>

        {/* How to Play */}
        <Card className='mt-4 bg-gray-800/30 border-gray-700/50'>
          <CardContent className='pt-4'>
            <h3 className='text-gray-300 font-semibold mb-2'>How to Play</h3>
            <div className='text-gray-400 text-sm space-y-1'>
              <p>
                ⬆️ <strong>Space / Up Arrow</strong> - Jump
              </p>
              <p>
                ⬇️ <strong>Down Arrow</strong> - Duck
              </p>
              <p>
                ⚡ <strong>Down while jumping</strong> - Fast Fall
              </p>
            </div>
            <div className='mt-3 pt-3 border-t border-gray-700/50 text-gray-500 text-xs'>
              <p className='mb-1'>
                📱 <strong>Mobile Controls:</strong>
              </p>
              <p>Tap top half = Jump • Tap bottom half = Duck</p>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className='mt-4 text-center'>
          <Button
            variant='link'
            onClick={() => router.push('/leaderboard')}
            className='text-gray-400 hover:text-white'
          >
            View Leaderboard →
          </Button>
        </div>
      </div>
    </main>
  );
}
