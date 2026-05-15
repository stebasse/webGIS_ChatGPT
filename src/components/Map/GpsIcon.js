import L from 'leaflet';

export const createGpsIcon = (deviceHeading = 0) => new L.DivIcon({
  html: `
    <div style="position: relative; width: 40px; height: 40px; margin-left: -20px; margin-top: -20px; transform: rotate(${deviceHeading}deg);">
       <svg viewBox="0 0 100 100" style="position: absolute; top: -30px; left: 0; width: 40px; height: 60px; opacity: 0.5;">
          <polygon points="50,100 0,0 100,0" fill="url(#grad1)" />
          <defs>
            <linearGradient id="grad1" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" style="stop-color:#34d399;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#34d399;stop-opacity:0" />
            </linearGradient>
          </defs>
       </svg>
       <div style="position: absolute; top: 15px; left: 15px; width: 10px; height: 10px; background: #34d399; border-radius: 50%; box-shadow: 0 0 10px #34d399;"></div>
    </div>
  `,
  className: '',
  iconSize: [0, 0]
});
