import { aggregateByDay } from '../../../git/aggregate.js';
import { CommitInfo, DailyCommit } from '../../../data/schema.js';

describe('aggregateByDay', () => {
  it('should return empty array for empty input', () => {
    expect(aggregateByDay([])).toEqual([]);
  });

  it('should return single commit for single input', () => {
    const commits: CommitInfo[] = [
      { hash: 'abc123', timestamp: 1704067200 }, // 2024-01-01 00:00:00 UTC
    ];
    
    const result = aggregateByDay(commits);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      date: '2024-01-01',
      hash: 'abc123',
      timestamp: 1704067200,
    });
  });

  it('should pick last commit of each day', () => {
    const commits: CommitInfo[] = [
      { hash: 'morning', timestamp: 1704078000 },  // 2024-01-01 03:00:00 UTC
      { hash: 'noon', timestamp: 1704110400 },     // 2024-01-01 12:00:00 UTC
      { hash: 'evening', timestamp: 1704139200 },  // 2024-01-01 20:00:00 UTC
    ];
    
    const result = aggregateByDay(commits);
    
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe('evening');
    expect(result[0].date).toBe('2024-01-01');
  });

  it('should handle multiple days', () => {
    const commits: CommitInfo[] = [
      { hash: 'day1-early', timestamp: 1704067200 },   // 2024-01-01 00:00:00 UTC
      { hash: 'day1-late', timestamp: 1704139200 },    // 2024-01-01 20:00:00 UTC
      { hash: 'day2-early', timestamp: 1704153600 },   // 2024-01-02 00:00:00 UTC
      { hash: 'day2-late', timestamp: 1704225600 },    // 2024-01-02 20:00:00 UTC
      { hash: 'day3', timestamp: 1704240000 },         // 2024-01-03 00:00:00 UTC
    ];
    
    const result = aggregateByDay(commits);
    
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ date: '2024-01-01', hash: 'day1-late', timestamp: 1704139200 });
    expect(result[1]).toEqual({ date: '2024-01-02', hash: 'day2-late', timestamp: 1704225600 });
    expect(result[2]).toEqual({ date: '2024-01-03', hash: 'day3', timestamp: 1704240000 });
  });

  it('should sort results by date', () => {
    // Input in random order
    const commits: CommitInfo[] = [
      { hash: 'day3', timestamp: 1704240000 },    // 2024-01-03
      { hash: 'day1', timestamp: 1704067200 },    // 2024-01-01
      { hash: 'day2', timestamp: 1704153600 },    // 2024-01-02
    ];
    
    const result = aggregateByDay(commits);
    
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-02');
    expect(result[2].date).toBe('2024-01-03');
  });

  it('should handle commits at midnight boundaries', () => {
    const commits: CommitInfo[] = [
      { hash: 'just-before', timestamp: 1704153599 },  // 2024-01-01 23:59:59 UTC
      { hash: 'midnight', timestamp: 1704153600 },     // 2024-01-02 00:00:00 UTC
      { hash: 'just-after', timestamp: 1704153601 },   // 2024-01-02 00:00:01 UTC
    ];
    
    const result = aggregateByDay(commits);
    
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[0].hash).toBe('just-before');
    expect(result[1].date).toBe('2024-01-02');
    expect(result[1].hash).toBe('just-after');
  });

  it('should use UTC timezone for date grouping', () => {
    // This timestamp is 2024-01-01 23:00:00 UTC
    // But could be 2024-01-02 in some timezones
    const commits: CommitInfo[] = [
      { hash: 'late-utc', timestamp: 1704150000 },  // 2024-01-01 23:00:00 UTC
    ];
    
    const result = aggregateByDay(commits);
    
    expect(result[0].date).toBe('2024-01-01');
  });
});
