import { useState, useEffect } from 'react';
import { formatTimeInterval } from '../utils/poissonCalculations.js';

export function useTimeElapsed(lastBlockTimestamp) {
  const [elapsedTime, setElapsedTime] = useState({ seconds: 0, minutes: 0, hours: 0, days: 0, formatted: '0s' });

  useEffect(() => {
    // Check if lastBlockTimestamp is valid (must be a positive number)
    if (!lastBlockTimestamp || !Number.isFinite(lastBlockTimestamp) || lastBlockTimestamp <= 0) {
      setElapsedTime({ seconds: 0, minutes: 0, hours: 0, days: 0, formatted: '0s' });
      // Debug: Log if timestamp is invalid
      if (lastBlockTimestamp !== undefined && lastBlockTimestamp !== null) {
        console.warn('Invalid lastBlockTimestamp:', lastBlockTimestamp, 'Type:', typeof lastBlockTimestamp);
      }
      return;
    }

    const updateElapsedTime = () => {
      // Get current time in UTC+3
      const now = new Date();
      const utc3Offset = 3 * 60 * 60 * 1000; // UTC+3 in milliseconds
      const currentTimeUTC3 = Math.floor((now.getTime() + utc3Offset) / 1000);
      
      // Ensure lastBlockTimestamp is treated as seconds (not milliseconds)
      // If it's > 1e12, it's likely in milliseconds, convert to seconds
      const lastBlockTimestampSeconds = lastBlockTimestamp > 1e12 
        ? Math.floor(lastBlockTimestamp / 1000)
        : lastBlockTimestamp;
      
      const elapsedSeconds = Math.max(0, currentTimeUTC3 - lastBlockTimestampSeconds);
      const days = Math.floor(elapsedSeconds / 86400);
      const hours = Math.floor((elapsedSeconds % 86400) / 3600);
      const minutes = Math.floor((elapsedSeconds % 3600) / 60);
      const seconds = Math.floor(elapsedSeconds % 60);

      setElapsedTime({
        seconds: elapsedSeconds,
        minutes,
        hours,
        days,
        formatted: formatTimeInterval(elapsedSeconds),
      });
    };

    // Update immediately
    updateElapsedTime();

    // Update every second
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [lastBlockTimestamp]);

  return elapsedTime;
}



