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
import { EASE_OUT, DUR_BASE, DUR_FAST } from './easing';

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

/** Quick fade for things that need to disappear cleanly. */
export const fadeOut = trigger('fadeOut', [
  transition(':leave', [
    animate(`${DUR_FAST} ${EASE_OUT}`, style({ opacity: 0 })),
  ]),
]);
