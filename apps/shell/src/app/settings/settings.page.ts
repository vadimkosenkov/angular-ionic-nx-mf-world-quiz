import { Component, inject } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  isThemePreference,
  SettingsStore,
  type ThemePreference,
} from '@world-quiz/client/settings';
import { flagAssetPath } from '@world-quiz/quiz/countries';
import { isLocale, type Locale } from '@world-quiz/quiz/domain';
import { APP_VERSION } from '../app-info';

interface ThemeOption {
  readonly value: ThemePreference;
  readonly icon: string;
}

interface LanguageOption {
  readonly value: Locale;
  /** The language's name in itself, shown in every UI language. */
  readonly nativeName: string;
  readonly flag: string;
}

@Component({
  selector: 'wq-settings-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonIcon,
    IonLabel,
    IonList,
    IonItem,
    IonRadioGroup,
    IonRadio,
    IonNote,
    TranslocoPipe,
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  protected readonly settings = inject(SettingsStore);
  protected readonly version = APP_VERSION;

  protected readonly themes: readonly ThemeOption[] = [
    { value: 'light', icon: 'sunny-outline' },
    { value: 'dark', icon: 'moon-outline' },
    { value: 'system', icon: 'phone-portrait-outline' },
  ];

  protected readonly languages: readonly LanguageOption[] = [
    { value: 'en', nativeName: 'English', flag: flagAssetPath('gb') },
    { value: 'ru', nativeName: 'Русский', flag: flagAssetPath('ru') },
  ];

  protected onThemeChange(value: unknown): void {
    if (isThemePreference(value)) {
      this.settings.setTheme(value);
    }
  }

  protected onLanguageChange(value: unknown): void {
    if (isLocale(value)) {
      this.settings.setLocale(value);
    }
  }
}
