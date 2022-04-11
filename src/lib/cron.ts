import { schedule } from 'node-cron';
import { Scraper } from './scraper';

export function scheduleCronJobs(): void {
  console.info('Initializing cron jobs');
  const scraper = new Scraper();

  // run every minute
  schedule('* * * * *', () => {
    const date = new Date();
    console.log(`\nRunning cron job @ ${date.toLocaleTimeString('de-DE', { hour12: false })}`);
    scraper.run();
  });
}
