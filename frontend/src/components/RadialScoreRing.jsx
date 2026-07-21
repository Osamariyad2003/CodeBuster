import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import './RadialScoreRing.css';

const RadialScoreRing = ({ score = 0, size = 80, strokeWidth = 8 }) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    // Slight delay for entrance animation
    const timeout = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timeout);
  }, [score]);

  useEffect(() => {
    if (animatedScore === 100) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10B981', '#ffffff', '#6c5ce7'],
        disableForReducedMotion: true
      });
    }
  }, [animatedScore]);

  // Calculate SVG attributes
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  // Determine color based on score
  let strokeColor = 'var(--color-success)'; // Neon green
  let glowColor = 'rgba(26, 127, 55, 0.6)';

  if (score < 40) {
    strokeColor = 'var(--color-danger)'; // Red
    glowColor = 'rgba(207, 34, 46, 0.6)';
  } else if (score < 80) {
    strokeColor = 'var(--color-warning)'; // Amber
    glowColor = 'rgba(154, 103, 0, 0.6)';
  } else if (score >= 90) {
    // Ultra vibrant green for high scores
    strokeColor = '#10B981'; // Tailwind Emerald 500
    glowColor = 'rgba(16, 185, 129, 0.8)';
  }

  return (
    <div className="score-ring-container" style={{ width: size, height: size }}>
      <svg className="score-ring-svg" viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="score-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="score-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          stroke={strokeColor}
          style={{ '--ring-glow-color': glowColor }}
        />
      </svg>
      <div className="score-ring-text">
        {score}
      </div>
    </div>
  );
};

export default RadialScoreRing;
