function compileNodeToReact(node) {
  if (node.type === 'TEXT') {
    return `<span className="text-primary">${node.characters}</span>`;
  }

  let classes = [];
  
  // Convert Auto Layout to Flexbox
  if (node.layoutMode === 'HORIZONTAL') classes.push('flex flex-row');
  if (node.layoutMode === 'VERTICAL') classes.push('flex flex-col');
  
  // Convert basic fills using your design tokens
  if (node.fills && node.fills[0]?.type === 'SOLID') {
    classes.push(`bg-${getBoundTokenName(node.fills[0])}`);
  }

  // Handle children recursively
  const childrenHtml = node.children ? node.children.map(compileNodeToReact).join('\n') : '';

  return `<div className="${classes.join(' ')}">\n${childrenHtml}\n</div>`;
}
