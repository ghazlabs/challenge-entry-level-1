'use client';

import ScoreOverlay from '@/components/ScoreOverlay';
import { Button } from '@/components/ui/button';
import {
  GameOverPayload,
  GameStartPayload,
  getSocket,
  OpponentUpdatePayload,
} from '@/lib/socket';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// Dynamic import for GameCanvas (client-side only)
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className='w-[800px] h-[300px] bg-gray-800 rounded-lg flex items-center justify-center text-gray-400'>
      Loading game...
    </div>
  ),
});

export default function GamePage() {
  const router = useRouter();
  const [gameData, setGameData] = useState<GameStartPayload | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentAlive, setOpponentAlive] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [myAlive, setMyAlive] = useState(true);
  const [opponentLeft, setOpponentLeft] = useState(false);

  // Load game data from session storage
  useEffect(() => {
    const storedData = sessionStorage.getItem('gameData');
    if (!storedData) {
      router.push('/');
      return;
    }

    const data = JSON.parse(storedData) as GameStartPayload;
    setGameData(data);

    // Start countdown
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count === 0) {
        clearInterval(countdownInterval);
        setTimeout(() => {
          setCountdown(null);
          setIsPlaying(true);
        }, 500);
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [router]);

  // Setup WebSocket listeners
  useEffect(() => {
    const socket = getSocket();

    const handleOpponentUpdate = (payload: unknown) => {
      const data = payload as OpponentUpdatePayload;
      setOpponentScore(data.score);
      setOpponentAlive(data.isAlive);
    };

    const handleOpponentLeft = (payload: unknown) => {
      const data = payload as OpponentUpdatePayload;
      setOpponentScore(data.score);
      setOpponentAlive(false);
      setOpponentLeft(true);
    };

    const handleGameOver = (payload: unknown) => {
      const data = payload as GameOverPayload;
      setGameOver(true);
      setIsPlaying(false);

      // Determine if we won, lost, or drew
      if (data.winnerId === '') {
        // Draw - no winner
        setIsWinner(null);
      } else {
        const storedData = sessionStorage.getItem('gameData');
        if (storedData) {
          const gameInfo = JSON.parse(storedData) as GameStartPayload;
          setIsWinner(data.winnerId === gameInfo.myId);
        }
      }
    };

    socket.on('OPPONENT_UPDATE', handleOpponentUpdate);
    socket.on('OPPONENT_LEFT', handleOpponentLeft);
    socket.on('GAME_OVER', handleGameOver);

    return () => {
      socket.off('OPPONENT_UPDATE', handleOpponentUpdate);
      socket.off('OPPONENT_LEFT', handleOpponentLeft);
      socket.off('GAME_OVER', handleGameOver);
    };
  }, []);

  const handleScoreUpdate = useCallback((score: number) => {
    setMyScore(score);
    const socket = getSocket();
    socket.updateScore(score);
  }, []);

  const handleMyGameOver = useCallback((score: number) => {
    setMyScore(score);
    setMyAlive(false);
    setIsPlaying(false);
    // Don't set gameOver yet - wait for server's GAME_OVER message
    // which will be sent when the opponent also dies

    const socket = getSocket();
    socket.playerDied(score);
  }, []);

  const handleLeaveGame = useCallback(() => {
    // Player wants to leave early (after dying) to play again
    const socket = getSocket();
    socket.leaveGame();
    sessionStorage.removeItem('gameData');
    router.push('/');
  }, [router]);

  const handleBackToLobby = () => {
    sessionStorage.removeItem('gameData');
    router.push('/');
  };

  if (!gameData) {
    return null;
  }

  return (
    <main className='min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-4'>
      <div className='text-center mb-4'>
        <h1 className='text-2xl font-bold text-white'>
          🦖 {gameData.myName} VS {gameData.opponentName} 🦖
        </h1>
        {opponentLeft && (
          <p className='text-yellow-400 text-sm mt-1'>Opponent left the game</p>
        )}
      </div>

      {/* Game Container */}
      <div className='relative'>
        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className='absolute inset-0 bg-black/80 flex items-center justify-center z-20 rounded-lg'>
            <div className='text-center'>
              <div className='text-8xl font-bold text-white animate-pulse'>
                {countdown === 0 ? 'GO!' : countdown}
              </div>
              <p className='text-gray-400 mt-4'>Get ready to jump!</p>
            </div>
          </div>
        )}

        {/* Score Overlay */}
        <ScoreOverlay
          myScore={myScore}
          opponentScore={opponentScore}
          opponentAlive={opponentAlive}
          myAlive={myAlive}
          gameOver={gameOver}
          isWinner={isWinner}
          onLeaveGame={handleLeaveGame}
        />

        {/* Game Canvas */}
        <GameCanvas
          seed={gameData.seed}
          isRunning={isPlaying}
          onScoreUpdate={handleScoreUpdate}
          onGameOver={handleMyGameOver}
        />
      </div>

      {/* Controls Info */}
      {!gameOver && isPlaying && (
        <div className='mt-4 text-center'>
          {/* Desktop Controls */}
          <div className='text-gray-500 text-sm mb-2'>
            <span className='text-white'>⬆️ SPACE / ↑</span> Jump •{' '}
            <span className='text-white'>⬇️ ↓</span> Duck •{' '}
            <span className='text-white'>↓ while jumping</span> Fast Fall
          </div>
          {/* Mobile Controls */}
          <div className='text-gray-600 text-xs'>
            📱 Mobile: <span className='text-gray-400'>Tap top half</span> =
            Jump • <span className='text-gray-400'>Tap bottom half</span> = Duck
          </div>
        </div>
      )}

      {/* Game Over Actions */}
      {gameOver && (
        <div className='mt-6 space-x-4'>
          <Button
            onClick={handleBackToLobby}
            className='bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
          >
            Play Again
          </Button>
          <Button
            onClick={() => router.push('/leaderboard')}
            variant='outline'
            className='border-gray-600 text-gray-300 hover:bg-gray-700'
          >
            Leaderboard
          </Button>
        </div>
      )}
    </main>
  );
}
