import fs from 'fs';
import path from 'path';

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;
const TARGET_NODES = process.env.FIGMA_TARGET_NODES ? process.env.FIGMA_TARGET_NODES.split(',') : [];

const OUTPUT_DIR = path.join(process.cwd(), 'src', 'generated');

// Main Orchestrator
async function run() {
  if (!FIGMA_TOKEN || !FILE_KEY) {
    console.error("Missing FIGMA_TOKEN or FIGMA_FILE_KEY environment variables.");
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("🚀 Starting Figma Node-to-Tailwind compilation...");
  await compileComponents();
}

async function compileComponents() {
  try {
    const nodeIdsParam = TARGET_NODES.join(',');
    const url = `https://figma.com{FILE_KEY}/nodes?ids=${nodeIdsParam}`;
    
    const response = await fetch(url, { headers: { 'X-Figma-Token': FIGMA_TOKEN } });
    const data = await response.json();

    for (const id of TARGET_NODES) {
      const rootNode = data.nodes[id]?.document;
      if (!rootNode) continue;

      const componentName = rootNode.name.replace(/[^a-zA-Z0-9]/g, '');
      console.log(`📦 Processing component: ${componentName}...`);
      
      const jsxBody = parseNode(rootNode);
      const fileContent = generateReactWrapper(componentName, jsxBody);
      
      fs.writeFileSync(path.join(OUTPUT_DIR, `${componentName}.jsx`), fileContent);
    }
    console.log("✅ Component compilation completed successfully!");
  } catch (error) {
    console.error("❌ Error running compilation pipeline:", error);
    process.exit(1);
  }
}

// Recursive Parser Engine
function parseNode(node) {
  if (!node || node.visible === false) return '';

  // Base types
  switch (node.type) {
    case 'TEXT':
      return parseTextNode(node);
    case 'FRAME':
    case 'INSTANCE':
    case 'COMPONENT':
      return parseLayoutNode(node);
    default:
      // Fallback or skipped nodes (VECTOR, RECTANGLE shapes treated as structural blocks or skipped if empty)
      return `<!-- Skipped node type: ${node.type} -->`;
  }
}

// 1. Core Layout Type Engine (Flexbox/Auto-Layout parsing)
function parseLayoutNode(node) {
  const classes = [];

  // Determine structural layouts via Auto-Layout flags
  if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
    classes.push('flex');
    classes.push(node.layoutMode === 'VERTICAL' ? 'flex-col' : 'flex-row');

    // Alignment maps
    if (node.counterAxisAlignItems === 'CENTER') classes.push('items-center');
    if (node.counterAxisAlignItems === 'END') classes.push('items-end');
    
    if (node.primaryAxisAlignItems === 'SPACE_BETWEEN') classes.push('justify-between');
    if (node.primaryAxisAlignItems === 'CENTER') classes.push('justify-center');
    if (node.primaryAxisAlignItems === 'END') classes.push('justify-end');

    // Gap settings (Mapping direct dimensions safely to tailwind layout steps)
    if (node.itemSpacing) {
      classes.push(getTailwindDimensionClass('gap', node.itemSpacing));
    }
  } else {
    // Relative/Absolute fallback container if not using Auto-Layout
    classes.push('relative');
  }

  // Padding mappings
  if (node.paddingTop) classes.push(getTailwindDimensionClass('pt', node.paddingTop));
  if (node.paddingBottom) classes.push(getTailwindDimensionClass('pb', node.paddingBottom));
  if (node.paddingLeft) classes.push(getTailwindDimensionClass('pl', node.paddingLeft));
  if (node.paddingRight) classes.push(getTailwindDimensionClass('pr', node.paddingRight));

  // Background and borders variables mapping
  if (node.fills && node.fills.length > 0) {
    const validFill = node.fills.find(f => f.type === 'SOLID');
    if (validFill) classes.push(getTailwindColorClass('bg', validFill));
  }
  
  if (node.strokes && node.strokes.length > 0 && node.strokeWeight > 0) {
    classes.push(`border-[${node.strokeWeight}px]`);
    const validStroke = node.strokes.find(s => s.type === 'SOLID');
    if (validStroke) classes.push(getTailwindColorClass('border', validStroke));
  }

  // Border Radius maps
  if (node.cornerRadius) {
    classes.push(`rounded-[${node.cornerRadius}px]`);
  }

  // Process inner items recursively
  const childrenCode = node.children 
    ? node.children.map(child => parseNode(child)).join('\n') 
    : '';

  const cleanClassName = classes.filter(Boolean).join(' ');
  return `<div className="${cleanClassName}">\n${childrenCode}\n</div>`;
}

// 2. Core Text Type Engine
function parseTextNode(node) {
  const classes = [];

  // Parse Text styling attributes
  const style = node.style;
  if (style) {
    if (style.fontWeight) classes.push(`font-[${style.fontWeight}]`);
    if (style.fontSize) classes.push(`text-[${style.fontSize}px]`);
    if (style.italic) classes.push('italic');
    
    if (style.textAlignHorizontal === 'CENTER') classes.push('text-center');
    if (style.textAlignHorizontal === 'RIGHT') classes.push('text-right');
  }

  // Parse Font colors
  if (node.fills && node.fills.length > 0) {
    const validFill = node.fills.find(f => f.type === 'SOLID');
    if (validFill) classes.push(getTailwindColorClass('text', validFill));
  }

  const cleanClassName = classes.filter(Boolean).join(' ');
  return `<span className="${cleanClassName}">${node.characters || ''}</span>`;
}

// Helper: Maps standard raw numbers down to Tailwind sizing variables
function getTailwindDimensionClass(prefix, pixelValue) {
  // Check if property utilizes dynamic bound variables before reverting to arbitrary values
  return `${prefix}-[${pixelValue}px]`;
}

// Helper: Converts Figma RGBA vectors into clean hexadecimal strings
function getTailwindColorClass(prefix, fillObj) {
  // If design maps a concrete token identifier name, resolve directly to it
  if (fillObj.boundVariables?.color?.name) {
    const tokenName = fillObj.boundVariables.color.name.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-');
    return `${prefix}-${tokenName}`;
  }
  
  // Custom Raw Hex fallback logic
  const { r, g, b, a } = fillObj.color;
  const toHex = (val) => Math.round(val * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return `${prefix}-[${hex}]`;
}

// Component boilerplate layout wrapper
function generateReactWrapper(componentName, jsxBody) {
  return `import React from 'react';

export function ${componentName}() {
  return (
    <>
      ${jsxBody}
    </>
  );
};

export default ${componentName};`;
}

run();
