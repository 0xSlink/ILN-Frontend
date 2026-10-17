'use client';

import React, { useEffect, useRef, useState } from 'react';
import useReducedMotion from '@/hooks/useReducedMotion';

/**
 * Easing function: ease-out cubic
 * Provides a smooth deceleration effect as the animation completes
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface AnimatedNumberProps {
  /** The target value to animate to */
  value: number;
  /** Animation duration in milliseconds (default: 1500) */
  duration?: number;
  /** Optional formatter function to transform the animated value */
  formatter?: (value: number) => string;
  /** CSS class name for styling */
  className?: string;
  /** Whether to re-animate when value changes (default: true) */
  reanimateOnChange?: boolean;
  /** Token symbol for currency display (e.g., '$', '€', 'USDC') */
  tokenSymbol?: string;
  /** Position of token symbol: 'prefix' or 'suffix' (default: 'prefix') */
  symbolPosition?: 'prefix' | 'suffix';
  /** Decimal places for formatting (default: 2) */
  decimals?: number;
  /** Locale for number formatting (default: 'en-US') */
  locale?: string;
}

/**
 * AnimatedNumber component that counts from 0 to a target value
 * using requestAnimationFrame for smooth 60fps animation.
 *
 * Features:
 * - Smooth ease-out cubic easing
 * - Honours prefers-reduced-motion via the shared useReducedMotion hook
 *   (degrades to an instant jump to the final value)
 * - Re-animates on value changes
 * - Custom formatter support
 * - No layout shift during animation
 */
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1500,
  formatter,
  className,
  reanimateOnChange = true,
  tokenSymbol,
  symbolPosition = 'prefix',
  decimals = 2,
  locale = 'en-US',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const previousValueRef = useRef<number>(0);
  const reducedMotion = useReducedMotion();

  // Animation function
  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);

    const currentValue =
      previousValueRef.current + (value - previousValueRef.current) * easedProgress;
    setDisplayValue(currentValue);

    if (progress < 1) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Ensure we land exactly on the target value
      setDisplayValue(value);
      startTimeRef.current = null;
    }
  };

  // Start animation when value changes (or when the motion preference changes)
  useEffect(() => {
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // If reduced motion is preferred, jump straight to the value
    if (reducedMotion) {
      setDisplayValue(value);
      return;
    }

    // Store the current display value as the starting point for smooth transitions
    previousValueRef.current = displayValue;
    startTimeRef.current = null;
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, reanimateOnChange, reducedMotion]);

  // Format the display value
  const formattedValue = formatter
    ? formatter(displayValue)
    : displayValue.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  // Add token symbol if provided
  const displayWithSymbol = tokenSymbol
    ? symbolPosition === 'prefix'
      ? `${tokenSymbol}${formattedValue}`
      : `${formattedValue}${tokenSymbol}`
    : formattedValue;

  return (
    <span className={className} data-testid="animated-number">
      {displayWithSymbol}
    </span>
  );
};

export default AnimatedNumber;
