import {
  type BootstrapContext,
  bootstrapApplication,
} from '@angular/platform-browser';
import { serverConfig } from './app/app.config.server';
import { SiteApp } from './app/app';

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(SiteApp, serverConfig, context);

export default bootstrap;
