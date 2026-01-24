#!/usr/bin/env node
/**
 * Deep spike analyzer - checks out commits and measures actual folder sizes
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { analyzeFolder } from './analysis/line-counter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Config {
  repo: string;
  old: string;
  ignoreOld: string[];
}

function loadConfig(): Config {
  const configPath = path.join(__dirname, '..', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  if (!config.repo || !config.old) {
    throw new Error('config.json must contain "repo" and "old" fields');
  }
  
  return {
    repo: config.repo,
    old: config.old,
    ignoreOld: config.ignoreOld || [],
  };
}

function findCommitForTimestamp(repoPath: string, timestamp: number): string {
  const endOfDay = timestamp + 86400 - 1;
  
  const output = execSync(
    `git log --all --before=${endOfDay} --format="%H" -1`,
    {
      cwd: repoPath,
      encoding: 'utf-8',
    }
  );
  
  return output.trim();
}

function getCommitInfo(repoPath: string, hash: string): { hash: string; date: string; message: string; author: string } {
  const output = execSync(
    `git show --no-patch --format="%H|%cI|%s|%an" ${hash}`,
    {
      cwd: repoPath,
      encoding: 'utf-8',
    }
  );
  
  const [fullHash, isoDate, message, author] = output.trim().split('|');
  
  return {
    hash: fullHash,
    date: isoDate,
    message,
    author,
  };
}

async function checkoutAndMeasure(
  repoPath: string,
  hash: string,
  oldPath: string,
  ignoreOld: string[]
): Promise<{ sizeKB: number; files: number }> {
  // Checkout
  console.log(`   Checking out ${hash.substring(0, 10)}...`);
  
  try {
    execSync(`git checkout --force --quiet ${hash}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
    });
  } catch (err) {
    throw new Error(`Failed to checkout: ${err}`);
  }
  
  // Measure
  const folderPath = path.join(repoPath, oldPath);
  const stats = await analyzeFolder(folderPath, ignoreOld);
  
  return stats;
}

async function analyzeSpikeDeep(
  config: Config,
  timestamp: number,
  compareToPrevious: boolean = true
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Deep Spike Analysis for timestamp: ${timestamp}`);
  console.log(`📅 Date: ${new Date(timestamp * 1000).toISOString()}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Find commit for this date
  const hash = findCommitForTimestamp(config.repo, timestamp);
  const info = getCommitInfo(config.repo, hash);
  
  console.log(`📝 Commit:`);
  console.log(`   Hash:    ${info.hash.substring(0, 16)}...`);
  console.log(`   Date:    ${info.date}`);
  console.log(`   Author:  ${info.author}`);
  console.log(`   Message: ${info.message}`);
  console.log('');
  
  // Save current branch
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: config.repo,
    encoding: 'utf-8',
  }).trim();
  
  try {
    // Measure current date
    console.log(`📏 Measuring folder size for this date...`);
    const currentStats = await checkoutAndMeasure(
      config.repo,
      hash,
      config.old,
      config.ignoreOld
    );
    
    console.log(`   Size: ${currentStats.sizeKB.toLocaleString()} KB`);
    console.log(`   Files: ${currentStats.files.toLocaleString()}`);
    console.log('');
    
    if (compareToPrevious) {
      // Find commit for previous day
      const prevTimestamp = timestamp - 86400;
      const prevHash = findCommitForTimestamp(config.repo, prevTimestamp);
      const prevInfo = getCommitInfo(config.repo, prevHash);
      
      console.log(`📏 Measuring folder size for previous day...`);
      console.log(`   Date: ${new Date(prevTimestamp * 1000).toISOString()}`);
      
      const prevStats = await checkoutAndMeasure(
        config.repo,
        prevHash,
        config.old,
        config.ignoreOld
      );
      
      console.log(`   Size: ${prevStats.sizeKB.toLocaleString()} KB`);
      console.log(`   Files: ${prevStats.files.toLocaleString()}`);
      console.log('');
      
      // Calculate delta
      const sizeDelta = currentStats.sizeKB - prevStats.sizeKB;
      const filesDelta = currentStats.files - prevStats.files;
      const sizePercent = prevStats.sizeKB > 0 ? ((sizeDelta / prevStats.sizeKB) * 100).toFixed(1) : 'N/A';
      
      console.log(`📈 Delta (current - previous):`);
      console.log(`   Size:  ${sizeDelta > 0 ? '+' : ''}${sizeDelta.toLocaleString()} KB (${sizePercent}%)`);
      console.log(`   Files: ${filesDelta > 0 ? '+' : ''}${filesDelta.toLocaleString()}`);
      console.log('');
      
      // If there's a big spike, try to find what changed
      if (Math.abs(sizeDelta) > 10000) {
        console.log(`⚠️  SPIKE DETECTED! Analyzing changes between commits...`);
        console.log('');
        
        try {
          const diffOutput = execSync(
            `git diff --stat ${prevHash} ${hash} -- ${config.old}`,
            {
              cwd: config.repo,
              encoding: 'utf-8',
              maxBuffer: 50 * 1024 * 1024,
            }
          );
          
          console.log(`📋 File changes between commits:`);
          console.log(diffOutput);
        } catch (err) {
          console.error(`   Error getting diff: ${err}`);
        }
      }
    }
  } finally {
    // Restore original branch
    console.log(`🔄 Restoring to ${currentBranch}...`);
    execSync(`git checkout --force --quiet ${currentBranch}`, {
      cwd: config.repo,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node dist/deep-spike-analysis.js <timestamp1> [timestamp2] ...');
    console.log('');
    console.log('Example:');
    console.log('  node dist/deep-spike-analysis.js 1754179200 1765065600');
    console.log('');
    console.log('Known suspicious dates:');
    console.log('  - August 3, 2025:    1754179200');
    console.log('  - December 7, 2025:  1765065600');
    process.exit(1);
  }
  
  const config = loadConfig();
  const timestamps = args.map(arg => parseInt(arg, 10));
  
  console.log(`\n🔧 Configuration:`);
  console.log(`   Repository: ${config.repo}`);
  console.log(`   Old path:   ${config.old}`);
  console.log(`   Ignoring:   ${config.ignoreOld.join(', ')}`);
  console.log('');
  
  for (const timestamp of timestamps) {
    try {
      await analyzeSpikeDeep(config, timestamp, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error analyzing timestamp ${timestamp}: ${message}`);
    }
  }
  
  console.log(`\n✅ Analysis complete!`);
}

main();
