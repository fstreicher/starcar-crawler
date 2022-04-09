import axios from 'axios';
import { load } from 'cheerio';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { AlertzyPriority, isRide, NOTIFY, Recipient, Ride } from '../types';
import { alertzy } from './alertzy';


export class Scraper {

  private readonly URL = 'https://www.starcar.de/specials/kostenlos-mieten/';

  public async run(): Promise<void> {
    const rides = await this.getRides();
    // load hashes from file
    let hashes: Set<string> = new Set();
    if (existsSync('./hashes.txt')) {
      hashes = new Set(readFileSync('./hashes.txt', { encoding: 'utf-8' }).split('\n'));
    }
    // compare rides against hashes
    const newRides = rides.filter(r => !hashes.has(this.hash(r)));
    // save new hashes
    this.saveRides(rides);
    // send notifications

    if (newRides.length > 0) {
      const recipients: Array<Recipient> = JSON.parse(readFileSync('./recipients.json', { encoding: 'utf-8' })) || [];
      recipients.forEach(recipient => {
        switch (recipient.notifyBy) {
          case NOTIFY.ALTERTZY:
            alertzy(
              recipient.notifyKey,
              newRides.length === 1 ? '1 neue Fahrt verfügbar' : `${newRides.length} neue Fahrten verfügbar`,
              newRides.map(r => `${r.car} von ${r.from} nach ${r.to} ${r.fuel ? `(${r.fuel})` : ''}\n${r.dateFrom} - ${r.dateTo}`.trim()).join('\n\n')
            );
            break;
        }
      });
    } else {
      console.info('No new rides');
    }
  }

  private async getRides(): Promise<Array<Ride>> {
    const page = await axios.get(this.URL);
    const $ = load(page.data);

    const rides = $('#start-city .area-flip.klm').toArray();
    const ridesData: Array<Ride> = rides
      .map(ride => {
        try {
          const $ride = $(ride);
          const children = $ride.children().toArray();
          const group = $ride.find('.flip-box-headline1').text().replace(/GRUPPE\s+/i, '');
          const car = $ride.find('.flip-box-headline2').text();
          const dates = $ride.find('.klm-date');
          const dateFrom = dates.eq(0).text().replace(/\n\s+/, ' ');
          const dateTo = dates.eq(-1).text().replace(/\n\s+/, ' ');
          const distance = $(children[6]).text().replace(/inkl.\s+/, '');
          const from = $(children[7]).contents().first().text().replace(/[\n\s]/g, '');
          const to = $(children[11]).contents().first().text().replace(/[\n\s]/g, '');
          const fuel = $ride.find('.marker .small2')?.text() ?? '';
          return {
            group,
            car,
            dateFrom,
            dateTo,
            from,
            to,
            distance,
            fuel,
            hash: this.hash({ group, car, dateFrom, dateTo, from, to, distance })
          } as Ride;
        } catch (e) {
          alertError(e as Error);
          return null;
        }
      })
      .filter((r): r is Ride => isRide(r));
    return ridesData;
  }

  private saveRides(rides: Array<Ride>): void {
    const hashes = rides.map(r => r.hash || this.hash(r));
    const uniqueHashes = [...new Set(hashes)];
    writeFileSync('./hashes.txt', uniqueHashes.join('\n'));
  }

  private hash(ride: Omit<Ride, 'fuel'>): string {
    if (!ride.hash) {
      return Object.values(ride).join('').replace(/[\s:\.-]+/g, '').toUpperCase();
    }
    return ride.hash;
  }
}

function alertError(e: Error): void {
  if (!existsSync('./error.txt')) {
    console.info('  \u27f9  Sending error notification!');
    writeFileSync('./error.txt', '1');
    alertzy(process.env.ALERTZY_KEY, 'Error', e?.message, AlertzyPriority.CRITICAL);
  }
}
