import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'wq-site',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class SiteApp {}
