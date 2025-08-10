// Vanilla JS i18n implementation
import en from './locales/en.json';
import lo from './locales/lo.json';
import km from './locales/km.json';

export interface TranslationResources {
  [key: string]: any;
}

class I18n {
  private currentLanguage: string = 'en';
  private translations: { [language: string]: TranslationResources } = {
    en,
    lo,
    km
  };

  constructor() {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('ui_language');
    if (savedLanguage && this.translations[savedLanguage]) {
      this.currentLanguage = savedLanguage;
    }
  }

  public t(key: string, params?: { [key: string]: string }): string {
    const keys = key.split('.');
    let value: any = this.translations[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English
        value = this.translations['en'];
        for (const fallbackKey of keys) {
          if (value && typeof value === 'object' && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return the key if not found
          }
        }
        break;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // Replace parameters if provided
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] || match;
      });
    }

    return value;
  }

  public changeLanguage(language: string): void {
    if (this.translations[language]) {
      this.currentLanguage = language;
      localStorage.setItem('ui_language', language);
      this.updateUI();
    }
  }

  public getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  public getCurrentLanguageData(): TranslationResources {
    return this.translations[this.currentLanguage] || this.translations['en'];
  }

  public init(): void {
    // Initialize and update UI
    this.updateUI();
    
    // Dispatch event to notify that i18n is ready
    window.dispatchEvent(new CustomEvent('i18nReady'));
  }

  public getSupportedLanguages(): { code: string; name: string; nativeName: string }[] {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'lo', name: 'Lao', nativeName: 'ລາວ' },
      { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ' }
    ];
  }

  private updateUI(): void {
    // Update all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key) {
        const htmlElement = element as HTMLElement;
        htmlElement.textContent = this.t(key);
      }
    });

    // Update placeholders
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (key) {
        const inputElement = element as HTMLInputElement;
        inputElement.placeholder = this.t(key);
      }
    });

    // Update title attributes
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      if (key) {
        const htmlElement = element as HTMLElement;
        htmlElement.title = this.t(key);
      }
    });

    // Dispatch custom event for other components to handle
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: this.currentLanguage }
    }));
  }

}

export const i18n = new I18n();