import React, { useEffect, useState } from 'react';
import './ParallaxBackground.css';

const ParallaxBackground = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let animationFrameId;
    
    const handleMouseMove = (e) => {
      // Calculate normalized mouse position from -1 to 1
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      
      // Debounce with requestAnimationFrame for smooth performance
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setMousePos({ x, y });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="parallax-bg-container">
      {/* Orb 1 moves opposite to mouse slightly */}
      <div 
        className="parallax-orb orb-1" 
        style={{ transform: `translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)` }}
      />
      {/* Orb 2 moves with mouse but slower */}
      <div 
        className="parallax-orb orb-2" 
        style={{ transform: `translate(${mousePos.x * 10}px, ${mousePos.y * 10}px)` }}
      />
      {/* Orb 3 moves opposite even more to create depth */}
      <div 
        className="parallax-orb orb-3" 
        style={{ transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px)` }}
      />
      
      {/* Subtle particle dust overlay */}
      <div 
        className="parallax-dust"
        style={{ backgroundPosition: `${mousePos.x * 15}px ${mousePos.y * 15}px` }}
      />
    </div>
  );
};

export default ParallaxBackground;
