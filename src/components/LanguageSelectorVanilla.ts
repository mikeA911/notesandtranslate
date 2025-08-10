import { i18n } from '../i18n-vanilla.js';

export class LanguageSelector {
  private container: HTMLDivElement;
  private select: HTMLSelectElement;
  private label: HTMLLabelElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId) as HTMLDivElement;
    if (!this.container) {
      throw new Error(`Container with id ${containerId} not found`);
    }

    this.createElements();
    this.bindEvents();
    this.updateLanguage();
  }

  private createElements(): void {
    this.container.className = 'language-selector';

    // Create label
    this.label = document.createElement('label');
    this.label.htmlFor = 'ui-language-select';
    this.label.setAttribute('data-i18n', 'settings.uiLanguage');
    this.label.className = 'language-selector-label';

    // Create select
    this.select = document.createElement('select');
    this.select.id = 'ui-language-select';
    this.select.className = 'language-selector-dropdown';

    // Add options
    const supportedLanguages = i18n.getSupportedLanguages();
    supportedLanguages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = `${lang.nativeName} (${lang.name})`;
      this.select.appendChild(option);
    });

    // Set current language
    this.select.value = i18n.getCurrentLanguage();

    // Append to container
    this.container.appendChild(this.label);
    this.container.appendChild(this.select);
  }

  private bindEvents(): void {
    this.select.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      i18n.changeLanguage(target.value);
    });

    // Listen for language changes from other sources
    window.addEventListener('languageChanged', () => {
      this.updateLanguage();
    });
  }

  private updateLanguage(): void {
    this.select.value = i18n.getCurrentLanguage();
    this.label.textContent = i18n.t('settings.uiLanguage');
  }

  public destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}