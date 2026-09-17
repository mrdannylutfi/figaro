// token-processor.js
import fs from 'fs';

async function fetchTokens() {
  const res = await fetch('https://figma.com', {
    headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN }
  });
  const data = await res.json();
  
  const theme = { colors: {}, spacing: {} };
  
  // Map Figma collections to Tailwind structures
  Object.values(data.meta.variables).forEach(variable => {
    const cleanName = variable.name.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-');
    
    if (variable.resolvedType === 'COLOR') {
      // Logic to parse Figma RGBA to Hex/RGB string
      theme.colors[cleanName] = parseFigmaColor(variable.valuesByMode); 
    } else if (variable.resolvedType === 'FLOAT') {
      theme.spacing[cleanName] = `${variable.valuesByMode[Object.keys(variable.valuesByMode)[0]]}px`;
    }
  });

  fs.writeFileSync('./theme.json', JSON.stringify(theme, null, 2));
}
