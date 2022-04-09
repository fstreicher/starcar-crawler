export interface Ride {
  group: string;
  car: string;
  distance: string;
  dateFrom: string;
  dateTo: string;
  from: string;
  to: string;
  fuel: string;
  hash?: string;
}

export function isRide(ride: any): ride is Ride {
  return ride.group && ride.car && ride.distance && ride.dateFrom && ride.dateTo && ride.from && ride.to;
}