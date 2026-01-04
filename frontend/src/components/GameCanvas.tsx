'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Seeded Random Number Generator using Linear Congruential Generator
 */
class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

interface GameCanvasProps {
  seed: number;
  isRunning: boolean;
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
}

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: 'cactus' | 'bird';
  y: number;
}

// Bird height types that are always beatable
type BirdHeight = 'high' | 'low';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const GROUND_Y = CANVAS_HEIGHT - 50;
const DINO_WIDTH = 40;
const DINO_HEIGHT = 50;
const DINO_DUCK_HEIGHT = 25;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const FAST_FALL_FORCE = 20;

// Fixed obstacle dimensions for consistent, beatable gameplay
const CACTUS_WIDTH = 25;
const CACTUS_HEIGHT = 45;
const BIRD_WIDTH = 35;
const BIRD_HEIGHT = 25;

// Bird Y positions
const BIRD_HIGH_Y = GROUND_Y - 80;
const BIRD_LOW_Y = GROUND_Y - 35;

export default function GameCanvas({
  seed,
  isRunning,
  onScoreUpdate,
  onGameOver,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef({
    dinoY: 0,
    dinoVelocity: 0,
    isJumping: false,
    isDucking: false,
    obstacles: [] as Obstacle[],
    score: 0,
    speed: 5,
    gameOver: false,
    rng: new SeededRNG(seed),
    lastObstacleType: null as 'cactus' | 'bird' | null,
    framesSinceLastObstacle: 0,
  });

  const resetGame = useCallback(() => {
    const state = gameStateRef.current;
    state.dinoY = 0;
    state.dinoVelocity = 0;
    state.isJumping = false;
    state.isDucking = false;
    state.obstacles = [];
    state.score = 0;
    state.speed = 5;
    state.gameOver = false;
    state.rng = new SeededRNG(seed);
    state.lastObstacleType = null;
    state.framesSinceLastObstacle = 0;
  }, [seed]);

  const jump = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isJumping && !state.gameOver && isRunning) {
      state.isJumping = true;
      state.dinoVelocity = JUMP_FORCE;
      state.isDucking = false;
    }
  }, [isRunning]);

  const duck = useCallback((isDucking: boolean) => {
    const state = gameStateRef.current;
    if (state.gameOver) return;

    if (isDucking) {
      if (state.isJumping) {
        // Fast fall: apply strong downward velocity
        state.dinoVelocity = FAST_FALL_FORCE;
        state.isDucking = true;
      } else {
        state.isDucking = true;
      }
    } else {
      state.isDucking = false;
    }
  }, []);

  useEffect(() => {
    resetGame();
  }, [seed, resetGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        duck(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        duck(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [jump, duck]);

  useEffect(() => {
    if (!isRunning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastScoreUpdate = 0;

    const getMinGapFrames = (speed: number): number => {
      // Minimum frames between obstacles based on speed
      // This ensures player has time to land from a jump before needing to react
      // At speed 5: ~80 frames (enough time for full jump cycle)
      // At higher speeds: proportionally less but still fair
      const jumpDuration = 40; // Approximate frames for a full jump
      const reactionTime = 20; // Extra frames for player reaction
      return Math.max(jumpDuration + reactionTime, 60 - speed * 2);
    };

    const spawnObstacle = () => {
      const state = gameStateRef.current;

      // Minimum gap based on speed to ensure gameplay is fair
      const minGapFrames = getMinGapFrames(state.speed);
      if (state.framesSinceLastObstacle < minGapFrames) {
        return;
      }

      // Random gap variation (add some extra frames for variety)
      const gapVariation = state.rng.next() * 40;
      if (state.framesSinceLastObstacle < minGapFrames + gapVariation) {
        return;
      }

      // Determine obstacle type
      // Birds only appear after score 100, and not too frequently
      const canSpawnBird = state.score > 100;
      const typeRandom = state.rng.next();

      // 70% cactus, 30% bird (when birds are available)
      const isBird = canSpawnBird && typeRandom > 0.7;

      // Prevent two birds in a row (would be confusing)
      const actuallyBird = isBird && state.lastObstacleType !== 'bird';

      let obstacle: Obstacle;

      if (actuallyBird) {
        // Choose bird height: 50% high (duck under), 50% low (jump over)
        const heightRandom = state.rng.next();
        const birdHeight: BirdHeight = heightRandom > 0.5 ? 'high' : 'low';

        obstacle = {
          x: CANVAS_WIDTH,
          width: BIRD_WIDTH,
          height: BIRD_HEIGHT,
          type: 'bird',
          y: birdHeight === 'high' ? BIRD_HIGH_Y : BIRD_LOW_Y,
        };
      } else {
        // Cactus - always jumpable with fixed height
        obstacle = {
          x: CANVAS_WIDTH,
          width: CACTUS_WIDTH,
          height: CACTUS_HEIGHT,
          type: 'cactus',
          y: GROUND_Y,
        };
      }

      state.obstacles.push(obstacle);
      state.lastObstacleType = obstacle.type;
      state.framesSinceLastObstacle = 0;
    };

    const update = () => {
      const state = gameStateRef.current;
      if (state.gameOver) return;

      state.framesSinceLastObstacle++;

      // Update dino physics
      if (state.isJumping) {
        state.dinoVelocity += GRAVITY;
        state.dinoY += state.dinoVelocity;

        if (state.dinoY >= 0) {
          state.dinoY = 0;
          state.isJumping = false;
          state.dinoVelocity = 0;
        }
      }

      // Update obstacles
      state.obstacles = state.obstacles.filter((obs) => {
        obs.x -= state.speed;
        return obs.x > -obs.width;
      });

      spawnObstacle();

      // Update score
      state.score += 1;

      // Send score updates every 10 frames
      if (state.score - lastScoreUpdate >= 10) {
        onScoreUpdate(state.score);
        lastScoreUpdate = state.score;
      }

      // Increase speed gradually (max speed 12)
      if (state.score % 500 === 0 && state.score > 0) {
        state.speed = Math.min(state.speed + 0.3, 12);
      }

      // Collision detection with smaller hitbox for fairness
      const dinoHeight = state.isDucking ? DINO_DUCK_HEIGHT : DINO_HEIGHT;
      const hitboxPadding = 5; // Slightly smaller hitbox for better feel
      const dinoBox = {
        x: 50 + hitboxPadding,
        y: GROUND_Y - dinoHeight + state.dinoY + hitboxPadding,
        width: DINO_WIDTH - hitboxPadding * 2,
        height: dinoHeight - hitboxPadding * 2,
      };

      for (const obs of state.obstacles) {
        const obsBox = {
          x: obs.x + hitboxPadding,
          y:
            obs.type === 'bird'
              ? obs.y + hitboxPadding
              : obs.y - obs.height + hitboxPadding,
          width: obs.width - hitboxPadding * 2,
          height: obs.height - hitboxPadding * 2,
        };

        if (
          dinoBox.x < obsBox.x + obsBox.width &&
          dinoBox.x + dinoBox.width > obsBox.x &&
          dinoBox.y < obsBox.y + obsBox.height &&
          dinoBox.y + dinoBox.height > obsBox.y
        ) {
          state.gameOver = true;
          onGameOver(state.score);
          return;
        }
      }
    };

    const render = () => {
      const state = gameStateRef.current;

      // Clear canvas
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw ground
      ctx.strokeStyle = '#4a4a6a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
      ctx.stroke();

      // Draw dino
      const dinoHeight = state.isDucking ? DINO_DUCK_HEIGHT : DINO_HEIGHT;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(
        50,
        GROUND_Y - dinoHeight + state.dinoY,
        DINO_WIDTH,
        dinoHeight
      );

      // Draw eye
      ctx.fillStyle = 'white';
      ctx.fillRect(75, GROUND_Y - dinoHeight + state.dinoY + 8, 8, 8);

      // Draw obstacles
      for (const obs of state.obstacles) {
        ctx.fillStyle = obs.type === 'bird' ? '#f59e0b' : '#ef4444';
        if (obs.type === 'bird') {
          // Draw bird shape
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          // Wing
          ctx.fillRect(obs.x + 5, obs.y - 5, obs.width - 10, 5);
        } else {
          // Draw cactus
          ctx.fillRect(obs.x, obs.y - obs.height, obs.width, obs.height);
          // Cactus arms
          ctx.fillRect(obs.x - 5, obs.y - obs.height + 15, 8, 15);
          ctx.fillRect(obs.x + obs.width - 3, obs.y - obs.height + 10, 8, 20);
        }
      }

      // Draw score
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(state.score).padStart(5, '0'), CANVAS_WIDTH - 20, 40);

      // Draw speed indicator
      ctx.font = '14px monospace';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`Speed: ${state.speed.toFixed(1)}`, CANVAS_WIDTH - 20, 60);
    };

    const gameLoop = () => {
      update();
      render();
      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isRunning, onScoreUpdate, onGameOver]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const y = touch.clientY - rect.top;
      const isBottomHalf = y > rect.height / 2;

      if (isBottomHalf) {
        // Tap on bottom half = duck
        duck(true);
      } else {
        // Tap on top half = jump
        jump();
      }
    },
    [jump, duck]
  );

  const handleTouchEnd = useCallback(() => {
    duck(false);
  }, [duck]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className='bg-gray-900 rounded-lg border border-gray-700 touch-none max-w-full h-auto'
      style={{ width: '100%', maxWidth: CANVAS_WIDTH }}
      onClick={jump}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    />
  );
}
