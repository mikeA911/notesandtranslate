#!/usr/bin/env node

/**
 * Version Update Script
 * 
 * This script updates the APP_VERSION in both service worker files
 * Usage: node update-version.js [version]
 * If no version is provided, it will auto-generate one with current timestamp
 */

const fs = require('fs');
const path = require('path');

// Generate version string (YYYY-MM-DD-XXX format)
function generateVersion() {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.getTime().toString().slice(-3); // Last 3 digits of timestamp
  return `${date}-${time}`;
}

// Update version in a file
function updateVersionInFile(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File ${filePath} not found, skipping...`);
    return false;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the APP_VERSION line
    const versionRegex = /const APP_VERSION = '[^']+';/;
    const newVersionLine = `const APP_VERSION = '${newVersion}';`;
    
    if (versionRegex.test(content)) {
      content = content.replace(versionRegex, newVersionLine);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${filePath} to version ${newVersion}`);
      return true;
    } else {
      console.warn(`Warning: APP_VERSION not found in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const version = args[0] || generateVersion();
  
  console.log(`🚀 Updating service worker to version: ${version}`);
  
  const files = [
    path.join(__dirname, 'sw.js'),
    path.join(__dirname, 'public', 'sw.js')
  ];
  
  let updatedCount = 0;
  files.forEach(file => {
    if (updateVersionInFile(file, version)) {
      updatedCount++;
    }
  });
  
  if (updatedCount > 0) {
    console.log(`\n✨ Successfully updated ${updatedCount} file(s)`);
    console.log(`📝 Remember to commit and push these changes to deploy to Netlify`);
    console.log(`🔍 Users can call clearAppCache() in console to force refresh if needed`);
  } else {
    console.log(`\n❌ No files were updated`);
    process.exit(1);
  }
}

// Run the script
main();