// frontend/src/app/core/motion/animations.ts
//
// Centralized Angular animation triggers. Components import these instead of
// defining triggers inline so motion stays consistent across the app.
import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger,
} from '@angular/animations';
import { EASE_OUT, EASE_SPRING, DUR_BASE, DUR_FAST, DUR_SLOW } from './easing';

/** Fade and slide up — for cards entering a list. */
export const fadeUp = trigger('fadeUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(8px)' }),
    animate(`${DUR_BASE} ${EASE_OUT}`, style({ opacity: 1, transform: 'none' })),
  ]),
]);

/** Stagger child enter animations across a list. */
export const staggerChildren = trigger('staggerChildren', [
  transition('* => *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        stagger(40, animate(`${DUR_BASE} ${EASE_OUT}`, style({ opacity: 1, transform: 'none' }))),
      ],
      { optional: true },
    ),
  ]),
]);

/**
 * Stack-build: an entering item slides up from the bottom edge into its
 * final position with a slight overshoot. Used on the generation timeline
 * when a new mod is added — visually reads as "stacking onto a load order."
 */
export const stackBuild = trigger('stackBuild', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(24px) scale(0.96)' }),
    animate(
      `${DUR_SLOW} ${EASE_SPRING}`,
      style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
    ),
  ]),
]);

/** Quick fade for things that need to disappear cleanly. */
export const fadeOut = trigger('fadeOut', [
  transition(':leave', [
    animate(`${DUR_FAST} ${EASE_OUT}`, style({ opacity: 0 })),
  ]),
]);
