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
        colors: ['#25E2A8', '#ffffff', '#FF570A'],
        disableForReducedMotion: true
      });
    }
  }, [animatedScore]);

  // Calculate SVG attributes
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  // Determine color based on score
  let strokeColor = 'var(--color-success, #25E2A8)'; // CodeRabbit Mint
  let glowColor = 'rgba(37, 226, 168, 0.6)';

  if (score < 40) {
    strokeColor = 'var(--color-danger, #EF4444)'; // Red
    glowColor = 'rgba(239, 68, 68, 0.6)';
  } else if (score < 80) {
    strokeColor = 'var(--color-warning, #F59E0B)'; // Amber
    glowColor = 'rgba(245, 158, 11, 0.6)';
  } else if (score >= 90) {
    // Ultra vibrant CodeRabbit Mint for high scores
    strokeColor = '#25E2A8';
    glowColor = 'rgba(37, 226, 168, 0.8)';
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
