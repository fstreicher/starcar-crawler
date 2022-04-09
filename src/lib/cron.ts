import { schedule } from 'node-cron';
import { Scraper } from './scraper';

export function scheduleCronJobs(): void {
  console.info('Initializing cron jobs')

  // run every 5 minutes
  schedule('*/5 * * * *', () => {
    const date = new Date();
    console.log(`\nRunning cron job @ ${date.toLocaleTimeString('de-DE', { hour12: false })}`);
    new Scraper().run();
  });
}
