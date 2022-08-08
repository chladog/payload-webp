import chalk from 'chalk';

export class Logger {
  debug: boolean;
  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  log(message: string, force = false) {
    if (this.debug || force) {
      return console.log(chalk.inverse.bold('payload-webp-plugin:') + chalk(' ' + message));
    }
  }

  err(message: string) {
    this.log(message, true);
  }
}
