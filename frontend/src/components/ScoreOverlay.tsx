'use client';

import { Button } from '@/components/ui/button';

interface ScoreOverlayProps {
  myScore: number;
  opponentScore: number;
  opponentAlive: boolean;
  myAlive: boolean;
  gameOver: boolean;
  isWinner: boolean | null;
  onLeaveGame?: () => void;
}

export default function ScoreOverlay({
  myScore,
  opponentScore,
  opponentAlive,
  myAlive,
  gameOver,
  isWinner,
  onLeaveGame,
}: ScoreOverlayProps) {
  return (
    <div className='absolute top-4 left-0 right-0 px-4 flex justify-between items-start pointer-events-none'>
      {/* My Score */}
      <div className='bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg'>
        <div className='text-xs text-gray-400 uppercase tracking-wide'>
          Your Score
        </div>
        <div className='text-2xl font-mono font-bold'>
          {String(myScore).padStart(5, '0')}
        </div>
        <div
          className={`text-xs mt-1 ${
            myAlive ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {myAlive ? '● ALIVE' : '○ DEAD'}
        </div>
      </div>

      {/* Opponent Status */}
      <div className='bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-right'>
        <div className='text-xs text-gray-400 uppercase tracking-wide'>
          Opponent
        </div>
        <div className='text-2xl font-mono font-bold'>
          {String(opponentScore).padStart(5, '0')}
        </div>
        <div
          className={`text-xs mt-1 ${
            opponentAlive ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {opponentAlive ? '● ALIVE' : '○ DEAD'}
        </div>
      </div>

      {/* Waiting for Opponent Overlay (player died but opponent still alive) */}
      {!myAlive && opponentAlive && !gameOver && (
        <div className='absolute inset-0 flex items-center justify-center pointer-events-auto'>
          <div className='bg-black/90 backdrop-blur-sm text-white px-8 py-6 rounded-xl text-center'>
            <div className='text-2xl font-bold mb-2'>💀 YOU DIED!</div>
            <div className='text-gray-400 mb-2'>
              Your Score:{' '}
              <span className='text-white font-mono'>{myScore}</span>
            </div>
            <div className='text-yellow-400 text-sm mb-4'>
              Waiting for opponent to finish...
            </div>
            {onLeaveGame && (
              <Button
                onClick={onLeaveGame}
                className='bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
              >
                🎮 Play Again (Leave Game)
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='bg-black/90 backdrop-blur-sm text-white px-8 py-6 rounded-xl text-center'>
            <div className='text-3xl font-bold mb-2'>
              {isWinner === null
                ? "🤝 IT'S A DRAW!"
                : isWinner
                ? '🎉 YOU WIN!'
                : '😢 YOU LOSE'}
            </div>
            <div className='text-gray-400'>
              Your Score:{' '}
              <span className='text-white font-mono'>{myScore}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
