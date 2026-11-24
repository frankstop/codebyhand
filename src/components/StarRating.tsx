import React from 'react';
import { Star } from 'lucide-react';

export interface StarRatingProps {
  solvedCount: number;
  totalProblems: number;
  size?: number;
  className?: string;
}

/**
 * CodingBat-inspired Gold Star Slots:
 * 1 gold star earned per 3 solved problems in that section:
 * totalStarSlots = Math.max(1, Math.floor(section.problems.length / 3))
 * earnedStars = Math.min(totalStarSlots, Math.floor(solvedInSection / 3))
 */
export const StarRating: React.FC<StarRatingProps> = ({
  solvedCount,
  totalProblems,
  size = 15,
  className = '',
}) => {
  const totalSlots = Math.max(1, Math.floor(totalProblems / 3));
  const earnedStars = Math.min(totalSlots, Math.floor(solvedCount / 3));
  const label = `${earnedStars} of ${totalSlots} gold star${totalSlots === 1 ? '' : 's'} earned`;

  return (
    <span
      className={`star-slots ${className}`.trim()}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: totalSlots }, (_, idx) => {
        const isEarned = idx < earnedStars;
        return (
          <Star
            key={idx}
            size={size}
            aria-hidden="true"
            focusable="false"
            className={isEarned ? 'star-icon is-earned' : 'star-icon is-empty'}
          />
        );
      })}
    </span>
  );
};
