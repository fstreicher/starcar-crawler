declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ALERTZY_KEY: string;
    }
  }
}

export { }