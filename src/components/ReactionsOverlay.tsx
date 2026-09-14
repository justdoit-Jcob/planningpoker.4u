import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ReactionEvent } from '../types';

interface ReactionsOverlayProps {
  reactions: ReactionEvent[];
}

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({ reactions }) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => {
          // Generate a pseudo-random x offset based on timestamp and id
          const randomX = (r.timestamp % 80) + 10;

          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: '85vh', x: `${randomX}vw`, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: '20vh', scale: [0.5, 1.3, 1.1, 0.8] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3.2, ease: 'easeOut' }}
              className="absolute flex flex-col items-center select-none"
            >
              <span className="text-4xl drop-shadow-md">{r.emoji}</span>
              <span className="text-xs bg-slate-900/80 text-white font-medium px-2 py-0.5 rounded-full shadow border border-slate-700 mt-1 backdrop-blur-xs">
                {r.userName}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
