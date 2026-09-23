import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { loadRuntimeConfig } from './app/runtime-config';
import { App } from './app/app';

// The environment's configuration is read before the application starts: the
// API URL and the Google client id are needed by the providers themselves.
loadRuntimeConfig()
  .then((runtime) => bootstrapApplication(App, appConfig(runtime)))
  .catch((err) => console.error(err));
