#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Bundle size thresholds (in KB)
const THRESHOLDS = {
  WARNING: 500,
  ERROR: 1000,
};

// Analyze bundle sizes
function analyzeBundleSizes() {
  const buildDir = path.join(process.cwd(), '.next/static/chunks');
  
  if (!fs.existsSync(buildDir)) {
    console.log('Build directory not found. Run "bun run build" first.');
    return;
  }

  const chunks = fs.readdirSync(buildDir)
    .filter(file => file.endsWith('.js'))
    .map(file => {
      const filePath = path.join(buildDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      
      return {
        name: file,
        size: sizeKB,
        path: filePath,
      };
    })
    .sort((a, b) => b.size - a.size);

  console.log('\nBundle Size Analysis:');
  console.log('========================');
  
  let totalSize = 0;
  let hasWarnings = false;
  
  chunks.forEach(chunk => {
    totalSize += chunk.size;
    const status = chunk.size > THRESHOLDS.ERROR ? '❌' : 
                   chunk.size > THRESHOLDS.WARNING ? '⚠️' : '✅';
    
    console.log(`${status} ${chunk.name}: ${chunk.size} KB`);
    
    if (chunk.size > THRESHOLDS.WARNING) {
      hasWarnings = true;
    }
  });
  
  console.log(`\nTotal Bundle Size: ${totalSize} KB`);
  
  if (hasWarnings) {
    console.log('\nOptimization Suggestions:');
    console.log('- Consider code splitting for large chunks');
    console.log('- Use dynamic imports for non-critical components');
    console.log('- Optimize third-party dependencies');
    console.log('- Enable tree shaking for unused code');
  } else {
    console.log('\nBundle sizes are within acceptable limits!');
  }
}

// Run analysis
if (require.main === module) {
  analyzeBundleSizes();
}

module.exports = { analyzeBundleSizes };
