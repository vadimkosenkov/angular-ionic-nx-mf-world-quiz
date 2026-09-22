import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { SiteApp } from './app/app';

bootstrapApplication(SiteApp, appConfig).catch((error) => console.error(error));
