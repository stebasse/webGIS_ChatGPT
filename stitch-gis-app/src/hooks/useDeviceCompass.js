import { useState, useEffect } from 'react';

export function useDeviceCompass() {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    const handleOrientation = (e) => {
      let h = e.webkitCompassHeading || Math.abs(e.alpha - 360);
      if (h) setHeading(h);
    };
    
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);
    
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return heading;
}
