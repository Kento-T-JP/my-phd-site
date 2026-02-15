'use client';

import React, { forwardRef } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import useClickSound from '@/lib/useClickSound';

export type ButtonProps = HTMLMotionProps<'button'>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', children, onClick, ...props }, ref) => {
    const shouldReduceMotion = useReducedMotion();
    const { play } = useClickSound();
    const base = shouldReduceMotion
      ? ''
      : 'transition-all duration-150 ease-out active:scale-95';
    return (
      <motion.button
        ref={ref}
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, scale: 1 }}
        exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
        className={`${base} ${className}`.trim()}
        onClick={(e) => {
          play();
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
