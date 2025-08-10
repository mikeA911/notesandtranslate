import React from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  onLanguageChange?: (language: string) => void;
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  onLanguageChange, 
  className = '' 
}) => {
  const { i18n, t } = useTranslation();

  const supportedLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'lo', name: 'Lao', nativeName: 'ລາວ' },
    { code: 'km', name: 'Khmer', nativeName: 'ខ្មែរ' }
  ];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem('ui_language', languageCode);
    onLanguageChange?.(languageCode);
  };

  return (
    <div className={`language-selector ${className}`}>
      <label htmlFor="ui-language-select" className="language-selector-label">
        {t('settings.uiLanguage')}
      </label>
      <select
        id="ui-language-select"
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className="language-selector-dropdown"
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName} ({lang.name})
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;