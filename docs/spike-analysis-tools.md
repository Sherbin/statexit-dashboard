# Spike Analysis Tools

Two tools for analyzing suspicious spikes in migration data.

## Tools

### 1. analyze-spike.js (Quick Analysis)

Analyzes git diff stats without checking out commits.

**Usage:**
```bash
npm run build
npm run analyze-spike 1754179200
```

**Output:**
- Commit information
- File changes summary
- Top 20 files by total changes (additions + deletions)

**Good for:** Quick overview without affecting your working directory

---

### 2. deep-spike-analysis.js (Deep Analysis)

Checks out commits and measures actual folder sizes.

**Usage:**
```bash
npm run build
npm run deep-spike 1754179200 1765065600
```

**Output:**
- Actual folder sizes at each date (respects ignoreOld config)
- Delta compared to previous day
- Percentage change
- Git diff between commits if spike > 10MB

**Good for:** Understanding actual size impact and comparing day-to-day

**⚠️ Warning:** This tool will checkout different commits in your source repository. Make sure you have no uncommitted changes first.

---

## Known Suspicious Dates

From `docs/progress.json`:

- **August 3, 2025**: `1754179200` (+82MB spike)
- **December 7, 2025**: `1765065600` (+52MB spike)

## Example

Analyze both spikes:
```bash
npm run deep-spike 1754179200 1765065600
```

## Configuration

Tools read from `config.json`:
- `repo`: Path to source repository
- `old`: Path to old folder (e.g., "static")
- `ignoreOld`: Subfolders to ignore when measuring size

## Results

See `spike-analysis-report.md` in the session files for detailed findings.
