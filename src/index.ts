import { scheduleCronJobs } from './lib/cron';
import { Scraper } from './lib/scraper';

scheduleCronJobs();

process.on('SIGINT', () => {
  console.info('\nShutting down gracefully...');
  process.exit(1);
});
