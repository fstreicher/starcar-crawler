export enum NOTIFY {
  ALTERTZY = 'alertzy',
  // PUSHOVER = 'pushover'
  // EMAIL = 'email',
}

export interface Recipient {
  name: string;
  notifyBy: NOTIFY;
  notifyKey: string;
  filter?: Record<string, string>;
}