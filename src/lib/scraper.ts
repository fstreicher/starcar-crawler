import axios from 'axios';
import { load } from 'cheerio';
import { val } from 'cheerio/lib/api/attributes';
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
      console.info(`${newRides.length} new rides found, notifying ${recipients.map(r => r.name).join(', ')}`);

      recipients.forEach(recipient => {

        const filters = recipient.filter;
        const filteredRides = [];
        if (filters) {
          newRides.forEach(ride => {
            filterLoop:
            for (const [key, value] of Object.entries(filters)) {
              const _key = key as keyof Ride;
              if (key in ride && !value.includes(';') && ride[_key] !== value) {
                break;
              } else if (key in ride && value.includes(';')) {
                const values = value.split(';');
                for (const v of values) {
                  if (
                    v.startsWith('!') && v.slice(1) === ride[_key] ||
                    !v.startsWith('!') && v !== ride[_key]
                  ) {
                    break filterLoop;
                  }
                }
              } else {
                filteredRides.push(ride);
              }
            }
          });
        } else {
          filteredRides.push(...newRides);
        }

        if (filteredRides.length > 0) {
          switch (recipient.notifyBy) {
            case NOTIFY.ALTERTZY:
              alertzy(
                recipient.notifyKey,
                filteredRides.length === 1 ? '1 neue Fahrt verfügbar' : `${filteredRides.length} neue Fahrten verfügbar`,
                filteredRides.map(r => `${r.car} (${r.group}) von ${r.from} nach ${r.to} ${r.fuel ? `(${r.fuel})` : ''}\n${r.dateFrom} - ${r.dateTo}`.trim()).join('\n\n')
              );
              break;
          }
        }
      });
    } else {
      console.info('No new rides');
    }
  }

  private async getRides(): Promise<Array<Ride>> {
    const page = await axios.get(this.URL).catch(e => alertError(e));
    if (!page) { return Promise.resolve([]); }
    const $ = load(page.data);

    const rides = $('#start-city .area-flip.klm').toArray();
    const ridesData: Array<Ride> = rides
      .map(ride => {
        try {
          const $ride = $(ride);
          const children = $ride.children().toArray();
          const car = $ride.find('.flip-box-headline2').text();
          const dates = $ride.find('.klm-date');
          const dateFrom = dates.eq(0).text().replace(/\n\s+/, ' ');
          const dateTo = dates.eq(-1).text().replace(/\n\s+/, ' ');
          const distance = $(children[6]).text().replace(/inkl.\s+/, '');
          const from = $(children[7]).contents().first().text().replace(/[\n\s]/g, '');
          const to = $(children[11]).contents().first().text().replace(/[\n\s]/g, '');
          const fuel = $ride.find('.marker .small2')?.text() ?? '';
          const dataAttributes = $ride.find('.button.button-black')?.attr();
          const group = dataAttributes['data-group-id'];
          const category = dataAttributes['data-category-key'];
          return {
            category,
            group,
            car,
            dateFrom,
            dateTo,
            from,
            to,
            distance,
            fuel,
            hash: this.hash({ group, car, dateFrom, dateTo, from, to, distance, fuel })
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
    if (rides?.length) {
      const hashes = rides.map(r => r.hash || this.hash(r));
      const uniqueHashes = [...new Set(hashes)];
      writeFileSync('./hashes.txt', uniqueHashes.join('\n'));
    }
  }

  private hash(ride: Omit<Ride, 'category'>): string {
    if (!ride.hash) {
      return Object.values(ride).join('').replace(/[\s:\.-]+/g, '').toUpperCase();
    }
    return ride.hash;
  }
}

function alertError(e: Error): void {
  if (!existsSync('./error.txt')) {
    console.info('  \u27f9  Sending error notification!');
    writeFileSync('./error.txt', JSON.stringify(e, null, 2));
    alertzy(process.env.ALERTZY_KEY, 'Error', e?.message, AlertzyPriority.CRITICAL);
  }
}
