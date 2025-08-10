/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {GoogleGenAI} from '@google/genai';
import {marked} from 'marked';

// Simple i18n translations
const translations = {
  'en': {
    'settings.title': 'Settings',
    'settings.uiLanguage': 'Interface Language',
    'settings.uiLanguageHelp': 'Language for the user interface',
    'settings.recordingLanguage': 'Record Language', 
    'settings.recordingLanguageHelp': 'Select the language you\'ll be speaking in your recordings',
    'settings.translationLanguages': 'Translation Languages',
    'settings.translationLanguagesHelp': 'Select which languages to show as translation options',
    'settings.save': 'Save Settings',
    'buttons.cancel': 'Cancel',
    'buttons.save': 'Save'
  },
  'lo': {
    'settings.title': 'ການຕັ້ງຄ່າ',
    'settings.uiLanguage': 'ພາສາສ່ວນຕິດຕໍ່ຜູ້ໃຊ້',
    'settings.uiLanguageHelp': 'ພາສາສຳລັບສ່ວນຕິດຕໍ່ຜູ້ໃຊ້',
    'settings.recordingLanguage': 'ພາສາບັນທຶກ',
    'settings.recordingLanguageHelp': 'ເລືອກພາສາທີ່ທ່ານຈະເວົ້າໃນການບັນທຶກ',
    'settings.translationLanguages': 'ພາສາການແປ',
    'settings.translationLanguagesHelp': 'ເລືອກພາສາທີ່ຈະສະແດງເປັນຕົວເລືອກການແປ',
    'settings.save': 'ບັນທຶກການຕັ້ງຄ່າ',
    'buttons.cancel': 'ຍົກເລີກ',
    'buttons.save': 'ບັນທຶກ'
  },
  'km': {
    'settings.title': 'ការកំណត់',
    'settings.uiLanguage': 'ភាសាចំនុចប្រទាក់',
    'settings.uiLanguageHelp': 'ភាសាសម្រាប់ចំនុចប្រទាក់អ្នកប្រើ',
    'settings.recordingLanguage': 'ភាសាថត',
    'settings.recordingLanguageHelp': 'ជ្រើសរើសភាសាដែលអ្នកនឹងនិយាយក្នុងការថត',
    'settings.translationLanguages': 'ភាសាបកប្រែ',
    'settings.translationLanguagesHelp': 'ជ្រើសរើសភាសាដែលត្រូវបង្ហាញជាជម្រើសបកប្រែ',
    'settings.save': 'រក្សាទុកការកំណត់',
    'buttons.cancel': 'បោះបង់',
    'buttons.save': 'រក្សាទុក'
  }
};

const MODEL_NAME = 'gemini-2.5-flash';
const DB_NAME = 'VoiceNotesDB';
const DB_VERSION = 3;

const SUPPORTED_LANGUAGES = {
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Portuguese: 'pt',
  Russian: 'ru',
  Japanese: 'ja',
  Korean: 'ko',
  Chinese: 'zh',
  Arabic: 'ar',
  Hindi: 'hi',
  Lao: 'lo',
  Khmer: 'km',
  Vietnamese: 'vi',
  Thai: 'th',
} as const;

type Language = keyof typeof SUPPORTED_LANGUAGES;
const ALL_LANGUAGES = Object.keys(SUPPORTED_LANGUAGES) as Language[];

interface Translation {
  lang: Language;
  text: string;
}

interface Note {
  id?: number; // Autoincremented by IndexedDB
  title: string;
  rawTranscription: string;
  polishedNote: string;
  translations: Translation[];
  timestamp: number;
  audioData?: string; // Base64 encoded audio data
  audioMimeType?: string; // MIME type of the audio (e.g., 'audio/webm')
}

class DBHelper {
    private db: IDBDatabase | null = null;

    public async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(new Error('Failed to open database.'));
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                
                // Delete old object store if it exists (for schema change)
                if (db.objectStoreNames.contains('notes')) {
                    db.deleteObjectStore('notes');
                }
                
                // Create new object store with autoIncrement but no keyPath
                // This allows IndexedDB to auto-generate IDs without expecting an 'id' field
                const store = db.createObjectStore('notes', { autoIncrement: true });
                
                // Create an index on timestamp for sorting
                store.createIndex('timestamp', 'timestamp', { unique: false });
            };
        });
    }

    private getStore(name: 'notes', mode: IDBTransactionMode): IDBObjectStore {
        if (!this.db) throw new Error('Database not initialized.');
        return this.db.transaction(name, mode).objectStore(name);
    }

    public async saveNote(note: Note): Promise<number> {
        return new Promise((resolve, reject) => {
            const store = this.getStore('notes', 'readwrite');
            
            // Create clean object without id for storage
            const noteData = {
                title: note.title,
                rawTranscription: note.rawTranscription,
                polishedNote: note.polishedNote,
                translations: note.translations,
                timestamp: note.timestamp,
                audioData: note.audioData,
                audioMimeType: note.audioMimeType
            };
            
            if (note.id) {
                // Update existing note using the ID as the key
                const request = store.put(noteData, note.id);
                request.onsuccess = () => resolve(note.id!);
                request.onerror = (e) => {
                    console.error('Failed to update note:', e);
                    reject(new Error('Failed to update note.'));
                };
            } else {
                // Create new note - IndexedDB will auto-generate the ID
                const request = store.add(noteData);
                request.onsuccess = () => resolve(request.result as number);
                request.onerror = (e) => {
                    console.error('Failed to save note:', e);
                    reject(new Error('Failed to save note.'));
                };
            }
        });
    }

    public async getAllNotes(): Promise<Note[]> {
        return new Promise((resolve, reject) => {
            const store = this.getStore('notes', 'readonly');
            const request = store.openCursor();
            const notes: Note[] = [];
            
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    // Combine the auto-generated key (ID) with the stored data
                    const note: Note = {
                        id: cursor.key as number,
                        ...cursor.value
                    };
                    notes.push(note);
                    cursor.continue();
                } else {
                    // Sort by timestamp (newest first) and resolve
                    notes.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(notes);
                }
            };
            request.onerror = () => reject(new Error('Failed to fetch notes.'));
        });
    }

    public async deleteNote(id: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const store = this.getStore('notes', 'readwrite');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to delete note.'));
        });
    }

}

class VoiceNotesApp {
  private genAI: GoogleGenAI | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordButton: HTMLButtonElement;
  private recordingStatus: HTMLDivElement;
  private rawTranscription: HTMLDivElement;
  private polishedNote: HTMLDivElement;
  private newButton: HTMLButtonElement;
  private themeToggleButton: HTMLButtonElement;
  private themeToggleIcon: HTMLElement;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private currentNote: Note | null = null;
  private stream: MediaStream | null = null;
  private editorTitle: HTMLDivElement;
  
  private recordingInterface: HTMLDivElement;
  private liveRecordingTitle: HTMLDivElement;
  private liveWaveformCanvas: HTMLCanvasElement | null;
  private liveWaveformCtx: CanvasRenderingContext2D | null = null;
  private liveRecordingTimerDisplay: HTMLDivElement;
  private statusIndicatorDiv: HTMLDivElement | null;
  
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private waveformDataArray: Uint8Array | null = null;
  private waveformDrawingId: number | null = null;
  private timerIntervalId: number | null = null;
  private recordingStartTime: number = 0;
  private recordingLimitTimeoutId: number | null = null;
  private readonly RECORDING_LIMIT_MS = 3 * 60 * 1000;
  
  private translationArea: HTMLDivElement;
  private translationControlsContainer: HTMLDivElement;
  private translationResultsContainer: HTMLDivElement;
  
  // Speech Synthesis
  private speechSynthesis: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private playRecordingButton: HTMLButtonElement;
  private voicePrompt: HTMLDivElement;
  private promptedLanguages: Set<Language> = new Set();
  private speakingButton: HTMLButtonElement | null = null;
  
  // Raw Voice Player
  private rawVoicePlayer: HTMLDivElement;
  private rawVoicePlayButton: HTMLButtonElement;
  private recordingInfo: HTMLSpanElement;
  private progressFill: HTMLDivElement;
  private currentTimeDisplay: HTMLSpanElement;
  private totalTimeDisplay: HTMLSpanElement;
  private volumeSlider: HTMLInputElement;
  private voicePlayerMessage: HTMLDivElement;
  private currentAudio: HTMLAudioElement | null = null;
  
  // Startup screen elements
  private startupScreen: HTMLDivElement;
  private imageContainer: HTMLDivElement;
  private currentImage: HTMLImageElement;
  private aboutOverlay: HTMLDivElement;
  private aboutBackButton: HTMLButtonElement;
  private aboutIconButton: HTMLButtonElement;
  private appContainer: HTMLDivElement;
  private currentImageIndex: number = 0;
  private images: string[] = ['ikeJ.png', 'ikeT.png'];
  
  // Settings
  private settingsButton: HTMLButtonElement;
  private settingsModal: HTMLDivElement;
  private settingsSaveButton: HTMLButtonElement;
  private settingsCancelButton: HTMLButtonElement;
  private settingsLanguageList: HTMLDivElement;
  private recordLanguageSelect: HTMLSelectElement;
  private selectedLanguages: Language[] = [];
  private recordLanguage: Language = 'English';
  private settingsBackup: { selectedLanguages: Language[], recordLanguage: Language } | null = null;
  
  // My Notes
  private db: DBHelper;
  private saveButton: HTMLButtonElement;
  private myNotesButton: HTMLButtonElement;
  private myNotesModal: HTMLDivElement;
  private myNotesBackButton: HTMLButtonElement;
  private myNotesList: HTMLDivElement;
  private isLoadedNoteReadOnly = false;

  // Credit system integration
  private creditIntegration: any = null;
  
  // UI Language support
  private currentUILanguage: 'en' | 'lo' | 'km' = 'en';
  private uiLanguageSelect: HTMLSelectElement | null = null;

  constructor() {
    this.db = new DBHelper();
    // Get all element references first
    this.appContainer = document.querySelector(
      '.app-container',
    ) as HTMLDivElement;
    this.startupScreen = document.getElementById(
      'startupScreen',
    ) as HTMLDivElement;
    this.imageContainer = document.getElementById(
      'imageContainer',
    ) as HTMLDivElement;
    this.currentImage = document.getElementById(
      'currentImage',
    ) as HTMLImageElement;
    this.aboutOverlay = document.getElementById(
      'aboutOverlay',
    ) as HTMLDivElement;
    this.aboutBackButton = document.getElementById(
      'aboutBackButton',
    ) as HTMLButtonElement;
    this.aboutIconButton = document.getElementById(
      'aboutIconButton',
    ) as HTMLButtonElement;

    this.recordButton = document.getElementById(
      'recordButton',
    ) as HTMLButtonElement;
    this.recordingStatus = document.getElementById(
      'recordingStatus',
    ) as HTMLDivElement;
    this.rawTranscription = document.getElementById(
      'rawTranscription',
    ) as HTMLDivElement;
    this.polishedNote = document.getElementById(
      'polishedNote',
    ) as HTMLDivElement;
    this.newButton = document.getElementById('newButton') as HTMLButtonElement;
    this.themeToggleButton = document.getElementById(
      'themeToggleButton',
    ) as HTMLButtonElement;
    this.themeToggleIcon = this.themeToggleButton.querySelector(
      'i',
    ) as HTMLElement;
    this.editorTitle = document.getElementById(
      'editorTitle',
    ) as HTMLDivElement;

    this.recordingInterface = document.querySelector(
      '.recording-interface',
    ) as HTMLDivElement;
    this.liveRecordingTitle = document.getElementById(
      'liveRecordingTitle',
    ) as HTMLDivElement;
    this.liveWaveformCanvas = document.getElementById(
      'liveWaveformCanvas',
    ) as HTMLCanvasElement;
    this.liveRecordingTimerDisplay = document.getElementById(
      'liveRecordingTimerDisplay',
    ) as HTMLDivElement;

    this.translationArea = document.getElementById(
      'translationArea',
    ) as HTMLDivElement;
    this.translationControlsContainer = document.getElementById(
      'translationControls',
    ) as HTMLDivElement;
    this.translationResultsContainer = document.getElementById(
        'translationResults',
    ) as HTMLDivElement;

    this.playRecordingButton = document.getElementById(
      'playRecordingButton',
    ) as HTMLButtonElement;
    this.voicePrompt = document.getElementById('voicePrompt') as HTMLDivElement;

    // Raw Voice Player elements
    this.rawVoicePlayer = document.getElementById('rawVoicePlayer') as HTMLDivElement;
    this.rawVoicePlayButton = document.getElementById('rawVoicePlayButton') as HTMLButtonElement;
    this.recordingInfo = document.getElementById('recordingInfo') as HTMLSpanElement;
    this.progressFill = document.getElementById('progressFill') as HTMLDivElement;
    this.currentTimeDisplay = document.getElementById('currentTime') as HTMLSpanElement;
    this.totalTimeDisplay = document.getElementById('totalTime') as HTMLSpanElement;
    this.volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
    this.voicePlayerMessage = document.querySelector('.voice-player-message') as HTMLDivElement;

    this.settingsButton = document.getElementById('settingsButton') as HTMLButtonElement;
    this.settingsModal = document.getElementById('settingsModal') as HTMLDivElement;
    this.settingsSaveButton = document.getElementById('settingsSaveButton') as HTMLButtonElement;
    this.settingsCancelButton = document.getElementById('settingsCancelButton') as HTMLButtonElement;
    this.settingsLanguageList = document.getElementById('settingsLanguageList') as HTMLDivElement;
    this.recordLanguageSelect = document.getElementById('recordLanguageSelect') as HTMLSelectElement;
    
    this.saveButton = document.getElementById('saveButton') as HTMLButtonElement;
    this.myNotesButton = document.getElementById('myNotesButton') as HTMLButtonElement;
    this.myNotesModal = document.getElementById('myNotesModal') as HTMLDivElement;
    this.myNotesBackButton = document.getElementById('myNotesBackButton') as HTMLButtonElement;
    this.myNotesList = document.getElementById('myNotesList') as HTMLDivElement;

    if (this.liveWaveformCanvas) {
      this.liveWaveformCtx = this.liveWaveformCanvas.getContext('2d');
    }

    if (this.recordingInterface) {
      this.statusIndicatorDiv = this.recordingInterface.querySelector(
        '.status-indicator',
      ) as HTMLDivElement;
    }

    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
    }

    this.init();
  }
  
  private async init(): Promise<void> {
      await this.db.init();
      
      // Load saved UI language or default to English
      const savedUILanguage = localStorage.getItem('ui_language') as 'en' | 'lo' | 'km';
      if (savedUILanguage && ['en', 'lo', 'km'].includes(savedUILanguage)) {
        this.currentUILanguage = savedUILanguage;
      } else {
        // Default to English for new users
        this.currentUILanguage = 'en';
      }
      
      // Initialize credit system integration after a short delay
      // This allows the credit system to initialize first
      setTimeout(() => {
        this.initializeCreditIntegration();
      }, 1000);
      
      this.initializeStartupScreen();
  }

  private initializeCreditIntegration(): void {
    // Get credit integration from window if available
    if ((window as any).creditIntegration) {
      this.creditIntegration = (window as any).creditIntegration;
      console.log('Credit integration connected to main app');
    } else {
      console.warn('Credit integration not found on window object');
    }
  }

  private getGenAI(): GoogleGenAI {
    if (!this.genAI) {
      if (!process.env.API_KEY) {
        const errorMsg = 'API_KEY is not configured. The app cannot connect to the AI service.';
        throw new Error(errorMsg);
      }
      this.genAI = new GoogleGenAI({
        apiKey: process.env.API_KEY,
      });
    }
    return this.genAI;
  }

  private initializeApp(): void {
    if (!this.speechSynthesis) {
        console.warn('Web Speech API (SpeechSynthesis) is not supported.');
        this.playRecordingButton.style.display = 'none';
    }

    this.initSettings();
    this.initUILanguageSelector();
    this.updateUILanguage();
    this.bindEventListeners();
    this.initTheme();

    document
      .querySelectorAll<HTMLElement>('[contenteditable][placeholder]')
      .forEach((el) => {
        this.initContentEditablePlaceholder(el);
      });

    this.createNewNote();
    this.recordingStatus.textContent = 'Ready to record';
  }

  private getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if (!this.speechSynthesis) {
        return resolve([]);
      }

      let voices = this.speechSynthesis.getVoices();
      if (voices.length) {
        return resolve(voices);
      }

      let poller: number | null = null;

      const onVoicesChanged = () => {
        voices = this.speechSynthesis!.getVoices();
        if (voices.length) {
          if (poller) clearInterval(poller);
          if (this.speechSynthesis) {
            this.speechSynthesis.onvoiceschanged = null;
          }
          resolve(voices);
        }
      };

      if (this.speechSynthesis) {
          this.speechSynthesis.onvoiceschanged = onVoicesChanged;
      }

      // Fallback polling for browsers that are slow or don't fire the event
      let attempts = 0;
      poller = window.setInterval(() => {
        voices = this.speechSynthesis!.getVoices();
        if (voices.length) {
          if (poller) clearInterval(poller);
          if (this.speechSynthesis) {
            this.speechSynthesis.onvoiceschanged = null;
          }
          resolve(voices);
        } else if (attempts > 10) {
          // Timeout after ~2 seconds
          if (poller) clearInterval(poller);
          if (this.speechSynthesis) {
            this.speechSynthesis.onvoiceschanged = null;
          }
          resolve([]); // Resolve with empty array on timeout
        }
        attempts++;
      }, 200);
    });
  }

  private initializeStartupScreen(): void {
    console.log('[DEBUG] Initializing startup screen...');
    
    // Initialize voices in background for speech synthesis
    this.getVoicesAsync().then(voices => {
      this.voices = voices;
      console.log(`[DEBUG] Found ${voices.length} system voices.`);
    });
    
    // Setup event listeners for startup screen
    this.bindStartupEventListeners();
  }

  private bindStartupEventListeners(): void {
    // Click handler to navigate to record page
    this.imageContainer.addEventListener('click', () => {
      this.proceedToApp();
    });

    // About back button handler
    this.aboutBackButton.addEventListener('click', () => {
      this.hideAboutPage();
    });

    // Touch/swipe handling for mobile and desktop
    let startX = 0;
    let startY = 0;
    let isSwipeDetected = false;

    // Mouse events for desktop
    this.imageContainer.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      isSwipeDetected = false;
    });

    this.imageContainer.addEventListener('mousemove', (e) => {
      if (startX === 0) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isSwipeDetected = true;
      }
    });

    this.imageContainer.addEventListener('mouseup', (e) => {
      if (!isSwipeDetected || startX === 0) {
        startX = 0;
        startY = 0;
        return;
      }

      const deltaX = e.clientX - startX;
      
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          this.handleSwipeRight();
        } else {
          this.handleSwipeLeft();
        }
      }
      
      startX = 0;
      startY = 0;
      isSwipeDetected = false;
    });

    // Touch events for mobile
    this.imageContainer.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwipeDetected = false;
    });

    this.imageContainer.addEventListener('touchmove', (e) => {
      if (startX === 0) return;
      
      const deltaX = e.touches[0].clientX - startX;
      const deltaY = e.touches[0].clientY - startY;
      
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isSwipeDetected = true;
        e.preventDefault(); // Prevent scrolling
      }
    });

    this.imageContainer.addEventListener('touchend', (e) => {
      if (!isSwipeDetected || startX === 0) {
        startX = 0;
        startY = 0;
        return;
      }

      const deltaX = e.changedTouches[0].clientX - startX;
      
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          this.handleSwipeRight();
        } else {
          this.handleSwipeLeft();
        }
      }
      
      startX = 0;
      startY = 0;
      isSwipeDetected = false;
    });
  }

  private handleSwipeRight(): void {
    // Navigate to next image
    this.currentImageIndex = (this.currentImageIndex + 1) % this.images.length;
    this.currentImage.classList.add('slide-left');
    
    setTimeout(() => {
      this.currentImage.src = this.images[this.currentImageIndex];
      this.currentImage.classList.remove('slide-left');
    }, 150);
  }

  private handleSwipeLeft(): void {
    // Show about page
    this.showAboutPage();
  }

  private showAboutPage(): void {
    this.aboutOverlay.classList.add('active');
  }

  private hideAboutPage(): void {
    this.aboutOverlay.classList.remove('active');
  }

  private proceedToApp(): void {
    console.log('[DEBUG] Proceeding to main application.');
    this.startupScreen.style.opacity = '0';
    this.startupScreen.addEventListener('transitionend', () => {
      this.startupScreen.style.display = 'none';
    }, { once: true });

    this.appContainer.classList.remove('initially-hidden');
    this.initializeApp();
  }

  private bindEventListeners(): void {
    this.recordButton.addEventListener('click', () => this.toggleRecording());
    this.newButton.addEventListener('click', () => this.createNewNote());
    this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
    this.aboutIconButton.addEventListener('click', () => this.showAboutPage());

    this.playRecordingButton.addEventListener('click', () => this.handlePlayRecording());
    
    // Raw Voice Player event listeners
    this.rawVoicePlayButton.addEventListener('click', () => this.toggleVoicePlayback());
    this.volumeSlider.addEventListener('input', () => this.updateVolume());
    
    this.settingsButton.addEventListener('click', () => this.openSettings());
    this.settingsSaveButton.addEventListener('click', () => this.saveAndCloseSettings());
    this.settingsCancelButton.addEventListener('click', () => this.cancelAndCloseSettings());
    this.settingsModal.addEventListener('click', (e) => {
        if (e.target === this.settingsModal) this.cancelAndCloseSettings();
    });

    this.saveButton.addEventListener('click', () => this.saveCurrentNote());
    this.myNotesButton.addEventListener('click', () => this.showMyNotes());
    this.myNotesBackButton.addEventListener('click', () => this.closeMyNotes());
    this.myNotesModal.addEventListener('click', (e) => {
        if (e.target === this.myNotesModal) this.closeMyNotes();
    });

    this.editorTitle.addEventListener('blur', () => this.handleTitleChange());

    window.addEventListener('resize', this.handleResize.bind(this));
  }
  
  private initSettings() {
    this.loadSettings();
    this.renderRecordLanguageSelect();
    this.renderLanguageCheckboxes();
    this.renderTranslationButtons();
  }
  
  private initUILanguageSelector() {
    const container = document.getElementById('uiLanguageSelector');
    if (!container) {
      console.warn('UI language selector container not found');
      return;
    }

    // Create language selector
    const label = document.createElement('label');
    label.htmlFor = 'ui-language-select';
    label.className = 'language-selector-label';
    label.textContent = 'Interface Language';

    this.uiLanguageSelect = document.createElement('select');
    this.uiLanguageSelect.id = 'ui-language-select';
    this.uiLanguageSelect.className = 'language-selector-dropdown';

    // Add language options
    const languages = [
      { code: 'en', name: 'English' },
      { code: 'lo', name: 'ລາວ (Lao)' },
      { code: 'km', name: 'ខ្មែរ (Khmer)' }
    ];

    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = lang.name;
      if (lang.code === this.currentUILanguage) {
        option.selected = true;
      }
      this.uiLanguageSelect!.appendChild(option);
    });

    // Add event listener
    this.uiLanguageSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.currentUILanguage = target.value as 'en' | 'lo' | 'km';
      localStorage.setItem('ui_language', this.currentUILanguage);
      this.updateUILanguage();
    });

    container.appendChild(label);
    container.appendChild(this.uiLanguageSelect);
  }

  private updateUILanguage() {
    // Update all elements with data-i18n attributes
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (key && translations[this.currentUILanguage] && translations[this.currentUILanguage][key]) {
        element.textContent = translations[this.currentUILanguage][key];
      }
    });

    // Update language selector label if it exists
    const label = document.querySelector('.language-selector-label');
    if (label && translations[this.currentUILanguage]['settings.uiLanguage']) {
      label.textContent = translations[this.currentUILanguage]['settings.uiLanguage'];
    }
  }

  private renderRecordLanguageSelect() {
    if (!this.recordLanguageSelect) {
      console.warn('Record language select element not found');
      return;
    }
    this.recordLanguageSelect.innerHTML = '';
    ALL_LANGUAGES.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      if (lang === this.recordLanguage) {
        option.selected = true;
      }
      this.recordLanguageSelect.appendChild(option);
    });
    // Remove the auto-save on change, we'll save only when user clicks Save
  }

  private renderLanguageCheckboxes() {
    this.settingsLanguageList.innerHTML = '';
    // Filter out the selected record language from translation options
    const availableForTranslation = ALL_LANGUAGES.filter(lang => lang !== this.recordLanguage);
    
    availableForTranslation.forEach(lang => {
      const isChecked = this.selectedLanguages.includes(lang);
      const option = document.createElement('div');
      option.className = 'language-option';
      option.innerHTML = `
        <input type="checkbox" id="lang-${lang}" name="language" value="${lang}" ${isChecked ? 'checked' : ''}>
        <label for="lang-${lang}">
          <span class="custom-checkbox">
            <i class="fas fa-check"></i>
          </span>
          ${lang}
        </label>
      `;
      // Remove auto-save on change, we'll save only when user clicks Save
      this.settingsLanguageList.appendChild(option);
    });
  }

  private loadSettings() {
    const savedLanguages = localStorage.getItem('selectedLanguages');
    if (savedLanguages) {
      const parsed = JSON.parse(savedLanguages) as Language[];
      // Filter to ensure only valid languages are loaded
      this.selectedLanguages = parsed.filter(lang => ALL_LANGUAGES.includes(lang));
    } else {
      // Default to only Khmer and Lao for new users
      this.selectedLanguages = ['Khmer', 'Lao'];
    }

    const savedRecordLanguage = localStorage.getItem('recordLanguage');
    if (savedRecordLanguage && ALL_LANGUAGES.includes(savedRecordLanguage as Language)) {
      this.recordLanguage = savedRecordLanguage as Language;
    } else {
      this.recordLanguage = 'English';
    }
  }

  private saveSettings() {
    const selected: Language[] = [];
    this.settingsLanguageList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked').forEach(cb => {
      selected.push(cb.value as Language);
    });
    
    // Remove record language from selected languages if it exists
    const oldRecordLanguage = this.recordLanguage;
    this.recordLanguage = this.recordLanguageSelect.value as Language;
    this.selectedLanguages = selected.filter(lang => lang !== this.recordLanguage);
    
    localStorage.setItem('selectedLanguages', JSON.stringify(this.selectedLanguages));
    localStorage.setItem('recordLanguage', this.recordLanguage);

    // If the record language changed, re-render the checkboxes to update the available options
    if (oldRecordLanguage !== this.recordLanguage) {
      this.renderLanguageCheckboxes();
    }
    
    this.renderTranslationButtons();
  }
  
  private renderTranslationButtons() {
    this.translationControlsContainer.innerHTML = '';
    this.selectedLanguages.forEach(lang => {
      const button = document.createElement('button');
      button.className = 'translation-button';
      button.dataset.lang = lang;
      button.innerHTML = `
        <span class="spinner"></span>
        <span>Translate to ${lang}</span>
      `;
      button.addEventListener('click', () => this.translateNote(lang));
      this.translationControlsContainer.appendChild(button);
    });
    this.updateTranslationButtonsState();
  }

  private openSettings() {
    // Backup current settings
    this.settingsBackup = {
      selectedLanguages: [...this.selectedLanguages],
      recordLanguage: this.recordLanguage
    };
    this.settingsModal.classList.remove('hidden');
  }

  private saveAndCloseSettings() {
    this.saveSettings();
    this.settingsModal.classList.add('hidden');
    this.settingsBackup = null;
  }

  private cancelAndCloseSettings() {
    // Restore backed up settings
    if (this.settingsBackup) {
      this.selectedLanguages = this.settingsBackup.selectedLanguages;
      this.recordLanguage = this.settingsBackup.recordLanguage;
      this.renderRecordLanguageSelect();
      this.renderLanguageCheckboxes();
      this.renderTranslationButtons();
    }
    this.settingsModal.classList.add('hidden');
    this.settingsBackup = null;
  }
  
  private async saveCurrentNote() {
    if (!this.currentNote) return;

    // Generate default title with date-time format: ddmmyy-HHMMSS
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const defaultTitle = `${day}${month}${year}-${hours}${minutes}${seconds}`;

    // Set the default title if empty or placeholder
    const currentTitle = this.editorTitle.textContent?.trim();
    if (!currentTitle || currentTitle === 'Untitled Note' || this.editorTitle.classList.contains('placeholder-active')) {
      this.editorTitle.textContent = defaultTitle;
      this.updatePlaceholderState(this.editorTitle);
    }

    // Ask user if they want to rename before saving
    const userTitle = prompt('Note title:', this.editorTitle.textContent || defaultTitle);
    if (userTitle === null) {
      // User cancelled
      this.recordingStatus.textContent = 'Save cancelled';
      return;
    }

    // Update title with user input or keep the current one
    const finalTitle = userTitle.trim() || defaultTitle;
    this.editorTitle.textContent = finalTitle;
    this.updatePlaceholderState(this.editorTitle);

    // Gather data from UI
    this.currentNote.title = finalTitle;
    this.currentNote.rawTranscription = this.rawTranscription.textContent || '';
    this.currentNote.polishedNote = this.currentNote.polishedNote || '';
    
    try {
        const id = await this.db.saveNote(this.currentNote);
        this.currentNote.id = id;
        this.recordingStatus.textContent = 'Note saved successfully!';
        
        // Give user time to see the message, then reset to a new note.
        setTimeout(() => {
            this.createNewNote();
        }, 1500);

    } catch(e) {
        console.error("Failed to save note", e);
        this.recordingStatus.textContent = `Error saving note.`;
    }
  }

  private async handleTitleChange() {
      // Auto-save title changes for saved notes
      if(this.currentNote && this.currentNote.id) {
          const newTitle = this.editorTitle.textContent?.trim() || 'Untitled Note';
          if(this.currentNote.title !== newTitle) {
              this.currentNote.title = newTitle;
              // This is a "background" save that doesn't reset the view
              await this.db.saveNote(this.currentNote);
          }
      }
      this.updatePlaceholderState(this.editorTitle);
  }

  private async showMyNotes() {
      try {
        const notes = await this.db.getAllNotes();

        this.myNotesList.innerHTML = ''; // Clear previous list
        if (notes.length === 0) {
            this.myNotesList.innerHTML = '<div class="no-notes-message">You haven\'t saved any notes yet.</div>';
        } else {
            notes.forEach(note => {
                const item = document.createElement('div');
                item.className = 'saved-note-item';
                item.innerHTML = `
                    <div class="note-item-info">
                        <span class="note-item-title">${note.title}</span>
                        <span class="note-item-timestamp">${new Date(note.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="note-item-actions">
                        <button class="note-action-button load" title="Load Note"><i class="fas fa-upload"></i></button>
                        <button class="note-action-button delete" title="Delete Note"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                item.querySelector('.load')?.addEventListener('click', () => this.loadNote(note));
                item.querySelector('.delete')?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteNote(note.id!, item);
                });
                this.myNotesList.appendChild(item);
            });
        }
      } catch (e) {
          console.error("Failed to load notes", e);
          this.myNotesList.innerHTML = '<div class="no-notes-message">Error loading saved notes.</div>';
      }
      this.myNotesModal.classList.remove('hidden');
  }

  private async loadNote(note: Note) {
      if (this.isRecording) await this.stopRecording();
      
      this.currentNote = note;
      this.isLoadedNoteReadOnly = true;
      this.recordButton.disabled = true;
      this.recordButton.classList.add('disabled');
      this.recordButton.setAttribute('title', 'Recording is disabled for saved notes');

      this.editorTitle.textContent = note.title;
      this.rawTranscription.textContent = note.rawTranscription;
      
      // Handle polished note - check if it exists and has content
      if (note.polishedNote && note.polishedNote.trim()) {
        try {
          const htmlContent = await marked.parse(note.polishedNote);
          this.polishedNote.innerHTML = htmlContent as string;
        } catch (error) {
          console.error('Error parsing markdown:', error);
          this.polishedNote.textContent = note.polishedNote;
        }
      } else {
        this.polishedNote.innerHTML = '<p><em>No polished note available</em></p>';
      }

      this.updatePlaceholderState(this.editorTitle);
      this.updatePlaceholderState(this.rawTranscription);
      this.updatePlaceholderState(this.polishedNote);
      
      this.translationArea.classList.add('hidden');
      this.translationResultsContainer.innerHTML = '';
      
      if(note.polishedNote) {
          this.translationArea.classList.remove('hidden');
      }

      // Restore all saved translations
      if (note.translations && note.translations.length > 0) {
        note.translations.forEach(t => this.renderTranslation(t.lang, t.text));
      }

      this.playRecordingButton.classList.toggle('hidden', !note.rawTranscription);
      this.updateTranslationButtonsState();
      this.updateVoicePlayer();

      this.closeMyNotes();
      this.recordingStatus.textContent = 'Note loaded. Recording is disabled.';
  }

  private async deleteNote(id: number, element: HTMLElement) {
      if(confirm('Are you sure you want to delete this note? This cannot be undone.')) {
        try {
            await this.db.deleteNote(id);
            element.remove();
            if (this.myNotesList.children.length === 0) {
              this.myNotesList.innerHTML = '<div class="no-notes-message">You haven\'t saved any notes yet.</div>';
            }
            if(this.currentNote?.id === id) {
                this.createNewNote();
            }
        } catch(e) {
            console.error("Failed to delete note", e);
            alert('Error deleting note.');
        }
      }
  }

  private closeMyNotes() {
      this.myNotesModal.classList.add('hidden');
  }

  private handleResize(): void {
    if (
      this.isRecording &&
      this.liveWaveformCanvas &&
      this.liveWaveformCanvas.style.display === 'block'
    ) {
      requestAnimationFrame(() => {
        this.setupCanvasDimensions();
      });
    }
  }
  
  private setupCanvasDimensions(): void {
    if (!this.liveWaveformCanvas || !this.liveWaveformCtx) return;

    const canvas = this.liveWaveformCanvas;
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    this.liveWaveformCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      document.body.classList.remove('light-mode');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private toggleTheme(): void {
    document.body.classList.toggle('light-mode');
    if (document.body.classList.contains('light-mode')) {
      localStorage.setItem('theme', 'light');
      this.themeToggleIcon.classList.remove('fa-sun');
      this.themeToggleIcon.classList.add('fa-moon');
    } else {
      localStorage.setItem('theme', 'dark');
      this.themeToggleIcon.classList.remove('fa-moon');
      this.themeToggleIcon.classList.add('fa-sun');
    }
  }

  private async toggleRecording(): Promise<void> {
    if (!this.isRecording) {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  private setupAudioVisualizer(): void {
    if (!this.stream || this.audioContext) return;

    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();

    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;

    const bufferLength = this.analyserNode.frequencyBinCount;
    this.waveformDataArray = new Uint8Array(bufferLength);

    source.connect(this.analyserNode);
  }
  
  private debugAudioLevels(): void {
    if (!this.analyserNode || !this.waveformDataArray || !this.isRecording) return;
    
    this.analyserNode.getByteFrequencyData(this.waveformDataArray);
    const average = this.waveformDataArray.reduce((a, b) => a + b, 0) / this.waveformDataArray.length;
    const max = Math.max(...this.waveformDataArray);
    
    if (average > 5 || max > 20) {
      console.log(`Audio levels - Average: ${average.toFixed(2)}, Max: ${max}, Input detected: ${average > 5 ? 'YES' : 'NO'}`);
    }
    
    // Check again in 1 second
    setTimeout(() => this.debugAudioLevels(), 1000);
  }

  private drawLiveWaveform(): void {
    if (
      !this.analyserNode ||
      !this.waveformDataArray ||
      !this.liveWaveformCtx ||
      !this.liveWaveformCanvas ||
      !this.isRecording
    ) {
      if (this.waveformDrawingId) cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
      return;
    }

    this.waveformDrawingId = requestAnimationFrame(() =>
      this.drawLiveWaveform(),
    );
    this.analyserNode.getByteFrequencyData(this.waveformDataArray);

    const ctx = this.liveWaveformCtx;
    const canvas = this.liveWaveformCanvas;

    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const bufferLength = this.analyserNode.frequencyBinCount;
    const numBars = Math.floor(bufferLength * 0.5);

    if (numBars === 0) return;

    const totalBarPlusSpacingWidth = logicalWidth / numBars;
    const barWidth = Math.max(1, Math.floor(totalBarPlusSpacingWidth * 0.7));
    const barSpacing = Math.max(0, Math.floor(totalBarPlusSpacingWidth * 0.3));

    let x = 0;

    const recordingColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-recording')
        .trim() || '#ff3b30';
    ctx.fillStyle = recordingColor;

    for (let i = 0; i < numBars; i++) {
      if (x >= logicalWidth) break;

      const dataIndex = Math.floor(i * (bufferLength / numBars));
      const barHeightNormalized = this.waveformDataArray[dataIndex] / 255.0;
      let barHeight = barHeightNormalized * logicalHeight;

      if (barHeight < 1 && barHeight > 0) barHeight = 1;
      barHeight = Math.round(barHeight);

      const y = Math.round((logicalHeight - barHeight) / 2);

      ctx.fillRect(Math.floor(x), y, barWidth, barHeight);
      x += barWidth + barSpacing;
    }
  }

  private updateLiveTimer(): void {
    if (!this.isRecording || !this.liveRecordingTimerDisplay) return;
    const now = Date.now();
    const elapsedMs = now - this.recordingStartTime;

    const remainingMs = this.RECORDING_LIMIT_MS - elapsedMs;
    if (remainingMs <= 10000) {
        this.liveRecordingTimerDisplay.style.color = 'var(--color-recording)';
    } else {
        this.liveRecordingTimerDisplay.style.color = 'var(--color-text)';
    }

    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((elapsedMs % 1000) / 10);

    this.liveRecordingTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }

  private startLiveDisplay(): void {
    if (
      !this.recordingInterface ||
      !this.liveRecordingTitle ||
      !this.liveWaveformCanvas ||
      !this.liveRecordingTimerDisplay
    ) {
      console.warn(
        'One or more live display elements are missing. Cannot start live display.',
      );
      return;
    }

    this.recordingInterface.classList.add('is-live');
    this.liveRecordingTitle.style.display = 'block';
    this.liveWaveformCanvas.style.display = 'block';
    this.liveRecordingTimerDisplay.style.display = 'block';

    this.setupCanvasDimensions();

    if (this.statusIndicatorDiv) this.statusIndicatorDiv.style.display = 'none';

    const iconElement = this.recordButton.querySelector(
      '.record-button-inner i',
    ) as HTMLElement;
    if (iconElement) {
      iconElement.classList.remove('fa-microphone');
      iconElement.classList.add('fa-stop');
    }

    const currentTitle = this.editorTitle.textContent?.trim();
    const placeholder =
      this.editorTitle.getAttribute('placeholder') || 'Untitled Note';
    this.liveRecordingTitle.textContent =
      currentTitle && currentTitle !== placeholder
        ? currentTitle
        : 'New Recording';

    this.setupAudioVisualizer();
    this.drawLiveWaveform();

    this.recordingStartTime = Date.now();
    this.updateLiveTimer();
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.timerIntervalId = window.setInterval(() => this.updateLiveTimer(), 50);
  }

  private stopLiveDisplay(): void {
    if (
      !this.recordingInterface ||
      !this.liveRecordingTitle ||
      !this.liveWaveformCanvas ||
      !this.liveRecordingTimerDisplay
    ) {
      if (this.recordingInterface)
        this.recordingInterface.classList.remove('is-live');
      return;
    }
    this.recordingInterface.classList.remove('is-live');
    this.liveRecordingTitle.style.display = 'none';
    this.liveWaveformCanvas.style.display = 'none';
    this.liveRecordingTimerDisplay.style.display = 'none';
    this.liveRecordingTimerDisplay.style.color = 'var(--color-text)'; // Reset color

    if (this.statusIndicatorDiv)
      this.statusIndicatorDiv.style.display = 'block';

    const iconElement = this.recordButton.querySelector(
      '.record-button-inner i',
    ) as HTMLElement;
    if (iconElement) {
      iconElement.classList.remove('fa-stop');
      iconElement.classList.add('fa-microphone');
    }

    if (this.waveformDrawingId) {
      cancelAnimationFrame(this.waveformDrawingId);
      this.waveformDrawingId = null;
    }
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    if (this.liveWaveformCtx && this.liveWaveformCanvas) {
      this.liveWaveformCtx.clearRect(
        0,
        0,
        this.liveWaveformCanvas.width,
        this.liveWaveformCanvas.height,
      );
    }

    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext
          .close()
          .catch((e) => console.warn('Error closing audio context', e));
      }
      this.audioContext = null;
    }
    this.analyserNode = null;
    this.waveformDataArray = null;
  }

  private async startRecording(): Promise<void> {
    try {
      if (this.isLoadedNoteReadOnly) {
          alert('Cannot record over a saved note. Please create a new note first.');
          return;
      }
      if(!this.currentNote?.id) { // Only create a new note if the current one isn't saved
        this.createNewNote();
      }
      this.audioChunks = [];
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
      }

      this.recordingStatus.textContent = 'Requesting microphone access...';

      try {
        // Start with basic audio constraints that worked before
        this.stream = await navigator.mediaDevices.getUserMedia({audio: true});
        console.log('✅ Audio stream acquired with basic constraints');
      } catch (err) {
        console.error('Failed with basic constraints, trying enhanced:', err);
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
          console.log('✅ Audio stream acquired with enhanced constraints');
        } catch (enhancedErr) {
          console.error('Failed with enhanced constraints, trying minimal:', enhancedErr);
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
          console.log('✅ Audio stream acquired with minimal constraints');
        }
      }

      // Basic audio track validation
      const audioTracks = this.stream.getAudioTracks();
      console.log(`✅ Audio stream has ${audioTracks.length} track(s)`);
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available in the stream');
      }

      // Try different audio formats, preferring formats that work better
      const formats = [
        { mimeType: 'audio/mpeg', ext: 'mp3' },
        { mimeType: 'audio/wav', ext: 'wav' },
        { mimeType: 'audio/mp4', ext: 'm4a' },
        { mimeType: 'audio/webm', ext: 'webm' },
      ];

      let formatUsed = null;
      for (const format of formats) {
        try {
          if (MediaRecorder.isTypeSupported(format.mimeType)) {
            this.mediaRecorder = new MediaRecorder(this.stream, {
              mimeType: format.mimeType
            });
            formatUsed = format;
            console.log(`✅ MediaRecorder created with ${format.mimeType}`);
            break;
          }
        } catch (e) {
          console.log(`❌ ${format.mimeType} not supported:`, e);
        }
      }

      // Fallback to default if no specific format worked
      if (!this.mediaRecorder) {
        this.mediaRecorder = new MediaRecorder(this.stream);
        formatUsed = { mimeType: 'audio/webm', ext: 'webm' }; // Default assumption
        console.log('✅ MediaRecorder created with default settings');
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0)
          this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        if (this.recordingLimitTimeoutId) {
            clearTimeout(this.recordingLimitTimeoutId);
            this.recordingLimitTimeoutId = null;
        }
        this.stopLiveDisplay();

        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          this.processAudio(audioBlob).catch((err) => {
            console.error('Error processing audio:', err);
            this.recordingStatus.textContent = 'Error processing recording';
          });
        } else {
          this.recordingStatus.textContent =
            'No audio data captured. Please try again.';
        }

        if (this.stream) {
          this.stream.getTracks().forEach((track) => {
            track.stop();
          });
          this.stream = null;
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      
      this.recordingLimitTimeoutId = window.setTimeout(() => {
          if(this.isRecording) {
            console.log('Recording limit reached. Stopping.');
            this.stopRecording();
          }
      }, this.RECORDING_LIMIT_MS);

      this.recordButton.classList.add('recording');
      this.recordButton.setAttribute('title', 'Stop Recording');

      this.startLiveDisplay();
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';

      if (
        errorName === 'NotAllowedError' ||
        errorName === 'PermissionDeniedError'
      ) {
        this.recordingStatus.textContent =
          'Microphone permission denied. Please check browser settings and reload page.';
      } else if (
        errorName === 'NotFoundError' ||
        (errorName === 'DOMException' &&
          errorMessage.includes('Requested device not found'))
      ) {
        this.recordingStatus.textContent =
          'No microphone found. Please connect a microphone.';
      } else if (
        errorName === 'NotReadableError' ||
        errorName === 'AbortError' ||
        (errorName === 'DOMException' &&
          errorMessage.includes('Failed to allocate audiosource'))
      ) {
        this.recordingStatus.textContent =
          'Cannot access microphone. It may be in use by another application.';
      } else {
        this.recordingStatus.textContent = `Error: ${errorMessage}`;
      }

      this.isRecording = false;
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.stopLiveDisplay();
    }
  }

  private async stopRecording(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
        this.stopLiveDisplay();
      }

      this.isRecording = false;

      this.recordButton.classList.remove('recording');
      this.recordButton.setAttribute('title', 'Start Recording');
      this.recordingStatus.textContent = 'Processing audio...';
    } else {
      if (!this.isRecording) this.stopLiveDisplay();
    }
  }

  private async processAudio(audioBlob: Blob): Promise<void> {
    if (audioBlob.size === 0) {
      this.recordingStatus.textContent =
        'No audio data captured. Please try again.';
      return;
    }

    try {
      URL.createObjectURL(audioBlob);

      this.recordingStatus.textContent = 'Converting audio...';

      const reader = new FileReader();
      const readResult = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;
            const base64Audio = base64data.split(',')[1];
            resolve(base64Audio);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await readResult;

      if (!base64Audio) throw new Error('Failed to convert audio to base64');

      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
      
      // Save the audio data to the current note
      if (this.currentNote) {
        this.currentNote.audioData = base64Audio;
        this.currentNote.audioMimeType = mimeType;
        console.log(`💾 Audio saved: ${mimeType}, size: ${base64Audio.length} chars`);
        this.updateVoicePlayer();
      }
      
      await this.getTranscription(base64Audio, mimeType);
    } catch (error) {
      console.error('Error in processAudio:', error);
      this.recordingStatus.textContent =
        'Error processing recording. Please try again.';
    }
  }

  private async getTranscription(
    base64Audio: string,
    mimeType: string,
  ): Promise<void> {
    try {
      this.recordingStatus.textContent = 'Getting transcription...';

      const ai = this.getGenAI();
      const recordLanguageCode = SUPPORTED_LANGUAGES[this.recordLanguage];
      const parts = [
        {text: `Generate a complete, detailed transcript of this audio. The speaker is speaking in ${this.recordLanguage} (language code: ${recordLanguageCode}). Please transcribe accurately in ${this.recordLanguage}.`},
        {inlineData: {mimeType: mimeType, data: base64Audio}},
      ];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
      });

      const transcriptionText = response.text;

      if (transcriptionText) {
        this.rawTranscription.textContent = transcriptionText;
        this.updatePlaceholderState(this.rawTranscription);
        this.playRecordingButton.classList.remove('hidden');
        console.log('✅ Play button should now be visible');

        if (this.currentNote)
          this.currentNote.rawTranscription = transcriptionText;
        this.recordingStatus.textContent =
          'Transcription complete. Polishing note...';
        
        // Credit system integration - check for polishing only (3 credits)
        if (this.creditIntegration) {
          try {
            const cost = this.creditIntegration.creditManager.getCost('polish');
            const hasCredits = this.creditIntegration.creditManager.hasSufficientCredits(cost);
            
            if (!hasCredits) {
              this.recordingStatus.textContent = 'Insufficient credits for polishing';
              this.creditIntegration.creditUI.showPurchaseModal();
              return;
            }

            // Show cost preview for polishing only
            const confirmed = await this.creditIntegration.creditUI.getCostPreview('polish');
            if (!confirmed) {
              this.recordingStatus.textContent = 'Polishing cancelled';
              return;
            }
          } catch (error) {
            console.error('Credit check failed:', error);
            // Continue with polishing if credit system fails
          }
        }
        
        this.getPolishedNote().catch((err) => {
          console.error('Error polishing note:', err);
          this.recordingStatus.textContent =
            'Error polishing note after transcription.';
        });
      } else {
        this.recordingStatus.textContent =
          'Transcription failed or returned empty.';
        this.polishedNote.innerHTML =
          '<p><em>Could not transcribe audio. Please try again.</em></p>';
        this.updatePlaceholderState(this.rawTranscription);
        this.updatePlaceholderState(this.polishedNote);
        this.translationArea.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error getting transcription:', error);
      this.recordingStatus.textContent = `Error getting transcription: ${error instanceof Error ? error.message : String(error)}`;
      this.polishedNote.innerHTML = `<p><em>Error during transcription: ${error instanceof Error ? error.message : String(error)}</em></p>`;
      this.updatePlaceholderState(this.rawTranscription);
      this.updatePlaceholderState(this.polishedNote);
      this.translationArea.classList.add('hidden');
    }
  }

  private async getPolishedNote(): Promise<void> {
    try {
      if (
        !this.rawTranscription.textContent ||
        this.rawTranscription.textContent.trim() === '' ||
        this.rawTranscription.classList.contains('placeholder-active')
      ) {
        this.recordingStatus.textContent = 'No transcription to polish';
        this.polishedNote.innerHTML =
          '<p><em>No transcription available to polish.</em></p>';
        this.updatePlaceholderState(this.polishedNote);
        this.translationArea.classList.add('hidden');
        return;
      }

      this.recordingStatus.textContent = 'Polishing note...';

      const prompt = `Take this raw transcription and create a polished, well-formatted note.
                    Remove filler words (um, uh, like), repetitions, and false starts.
                    Format any lists or bullet points properly. Use markdown formatting for headings, lists, etc.
                    Maintain all the original content and meaning.

                    Raw transcription:
                    ${this.rawTranscription.textContent}`;

      const ai = this.getGenAI();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      const polishedText = response.text;

      if (polishedText) {
        const htmlContent = await marked.parse(polishedText);
        this.polishedNote.innerHTML = htmlContent as string;
        this.updatePlaceholderState(this.polishedNote);

        let noteTitleSet = false;
        const lines = polishedText.split('\n').map((l) => l.trim());

        for (const line of lines) {
          if (line.startsWith('#')) {
            const title = line.replace(/^#+\s+/, '').trim();
            if (this.editorTitle && title) {
              this.editorTitle.textContent = title;
              this.updatePlaceholderState(this.editorTitle);
              noteTitleSet = true;
              break;
            }
          }
        }

        if (!noteTitleSet && this.editorTitle) {
          for (const line of lines) {
            if (line.length > 0) {
              let potentialTitle = line.replace(
                /^[\*_\`#\->\s\[\]\(.\d)]+/,
                '',
              );
              potentialTitle = potentialTitle.replace(/[\*_\`#]+$/, '');
              potentialTitle = potentialTitle.trim();

              if (potentialTitle.length > 3) {
                const maxLength = 60;
                this.editorTitle.textContent =
                  potentialTitle.substring(0, maxLength) +
                  (potentialTitle.length > maxLength ? '...' : '');
                this.updatePlaceholderState(this.editorTitle);
                noteTitleSet = true;
                break;
              }
            }
          }
        }

        if (!noteTitleSet && this.editorTitle) {
          this.updatePlaceholderState(this.editorTitle);
        }

        if (this.currentNote) {
            this.currentNote.polishedNote = polishedText;
            this.currentNote.title = this.editorTitle.textContent || 'Untitled Note';
        }

        // Deduct credits after successful polishing (3 credits)
        if (this.creditIntegration) {
          try {
            const cost = this.creditIntegration.creditManager.getCost('polish');
            await this.creditIntegration.creditManager.deductCredits(cost, 'polish', {
              type: 'polish_text',
              source: 'voice_to_polish',
              timestamp: Date.now()
            });
            console.log(`Deducted ${cost} credits for polishing note`);
          } catch (error) {
            console.error('Failed to deduct credits for polishing:', error);
          }
        }

        this.recordingStatus.textContent =
          'Note polished. Ready for next recording.';

        this.translationArea.classList.remove('hidden');
        this.translationResultsContainer.innerHTML = ''; // Clear previous results
        this.updateTranslationButtonsState();
      } else {
        this.recordingStatus.textContent =
          'Polishing failed or returned empty.';
        this.polishedNote.innerHTML =
          '<p><em>Polishing returned empty. Raw transcription is available.</em></p>';
        this.updatePlaceholderState(this.polishedNote);
        this.translationArea.classList.add('hidden');
      }
    } catch (error) {
      console.error('Error polishing note:', error);
      this.recordingStatus.textContent = `Error polishing note: ${error instanceof Error ? error.message : String(error)}`;
      this.polishedNote.innerHTML = `<p><em>Error during polishing: ${error instanceof Error ? error.message : String(error)}</em></p>`;
      this.updatePlaceholderState(this.polishedNote);
      this.translationArea.classList.add('hidden');
    }
  }

  private async translateNote(language: Language): Promise<void> {
    const polishedNoteMarkdown = this.currentNote?.polishedNote;
    if (!polishedNoteMarkdown || polishedNoteMarkdown.trim() === '') {
      // Maybe show a more elegant message later
      alert('There is no polished note to translate.');
      return;
    }

    // Credit system integration
    if (this.creditIntegration) {
      try {
        const cost = this.creditIntegration.creditManager.getCost('translate');
        const hasCredits = this.creditIntegration.creditManager.hasSufficientCredits(cost);
        
        if (!hasCredits) {
          this.creditIntegration.creditUI.showPurchaseModal();
          return;
        }

        // Show cost preview and get confirmation
        const confirmed = await this.creditIntegration.creditUI.getCostPreview('translate');
        if (!confirmed) {
          return;
        }
      } catch (error) {
        console.error('Credit check failed:', error);
        // Continue with translation if credit system fails
      }
    }

    const buttons = this.translationControlsContainer.querySelectorAll<HTMLButtonElement>('.translation-button');
    buttons.forEach(b => b.disabled = true);
    
    const clickedButton = this.translationControlsContainer.querySelector<HTMLButtonElement>(`[data-lang="${language}"]`);
    if(clickedButton) clickedButton.classList.add('loading');

    this.voicePrompt.classList.add('hidden');
    
    // Create a temporary placeholder card
    const tempCard = document.createElement('div');
    tempCard.className = 'translation-result-item';
    tempCard.textContent = `Translating to ${language}...`;
    this.translationResultsContainer.appendChild(tempCard);

    try {
      const prompt = `Translate the following text into ${language}. 

IMPORTANT: Provide ONLY the direct translation. Do not include phrases like "Here is the translation:", "Here is the polished note:", or any other introductory text. Start directly with the translated content.

Text to translate:
${polishedNoteMarkdown}`;

      const ai = this.getGenAI();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      let translation = response.text;
      
      // Clean up any unwanted introductory phrases
      if (translation) {
        translation = translation.replace(/^(Here is the translation:|Here is the polished note:|Translation:|Here is the .* translation:)\s*/i, '').trim();
      }

      // Remove temp card if it exists
      if (tempCard && tempCard.parentNode === this.translationResultsContainer) {
        this.translationResultsContainer.removeChild(tempCard);
      }

      if (translation) {
        
        // Deduct credits after successful translation
        if (this.creditIntegration) {
          try {
            const cost = this.creditIntegration.creditManager.getCost('translate');
            await this.creditIntegration.creditManager.deductCredits(cost, 'translate', {
              language: language,
              type: 'individual_translation',
              timestamp: Date.now()
            });
            console.log(`Deducted ${cost} credits for ${language} translation`);
          } catch (error) {
            console.error('Failed to deduct credits for translation:', error);
          }
        }
        
        if(this.currentNote) {
            const existingTranslation = this.currentNote.translations.find(t => t.lang === language);
            if(existingTranslation) {
                existingTranslation.text = translation;
            } else {
                this.currentNote.translations.push({ lang: language, text: translation });
            }
        }
        this.renderTranslation(language, translation);
        this.updateTranslationButtonsState();
      } else {
        this.renderTranslation(language, `Translation to ${language} failed or returned empty.`);
      }
    } catch (error) {
      // Remove temp card if it exists and handle error
      if (tempCard && tempCard.parentNode === this.translationResultsContainer) {
        this.translationResultsContainer.removeChild(tempCard);
      }
      console.error(`Error translating to ${language}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.renderTranslation(language, `Error translating to ${language}: ${errorMessage}`);
    } finally {
      buttons.forEach(b => {
        // Re-enable based on current translation state, not just blanket enable
        this.updateTranslationButtonsState();
      });
      if(clickedButton) clickedButton.classList.remove('loading');
    }
  }

  private renderTranslation(lang: Language, text: string): void {
    const card = document.createElement('div');
    card.className = 'translation-result-item';

    const header = document.createElement('div');
    header.className = 'translation-result-header';
    
    const title = document.createElement('h4');
    title.textContent = `${lang} Translation`;

    const speechButton = document.createElement('button');
    speechButton.className = 'speech-button';
    speechButton.title = `Read ${lang} translation aloud`;
    speechButton.innerHTML = `<i class="fas fa-volume-high"></i>`;
    speechButton.addEventListener('click', () => {
        this.handleTranslationSpeechClick(lang, text, speechButton);
    });

    header.appendChild(title);
    header.appendChild(speechButton);

    const body = document.createElement('div');
    body.className = 'translation-result-body';
    body.textContent = text;
    
    card.appendChild(header);
    card.appendChild(body);

    this.translationResultsContainer.appendChild(card);
  }

  private updateTranslationButtonsState(): void {
    const translatedLangs = new Set(this.currentNote?.translations.map(t => t.lang));
    const buttons = this.translationControlsContainer.querySelectorAll<HTMLButtonElement>('.translation-button');
    buttons.forEach(button => {
        const lang = button.dataset.lang as Language;
        if (translatedLangs.has(lang)) {
            button.disabled = true;
        } else {
            button.disabled = false;
        }
    });
  }

  private createNewNote(): void {
    console.log('[DEBUG] "New Note" button clicked. Resetting state.');
    if (this.speechSynthesis?.speaking) {
      this.speechSynthesis.cancel();
    }

    this.isLoadedNoteReadOnly = false;
    this.recordButton.disabled = false;
    this.recordButton.classList.remove('disabled');
    this.recordButton.setAttribute('title', 'Start/Stop Recording');

    this.speakingButton = null;
    this.promptedLanguages.clear();
    this.voicePrompt.classList.add('hidden');

    this.currentNote = {
      title: '',
      rawTranscription: '',
      polishedNote: '',
      translations: [],
      timestamp: Date.now(),
      audioData: undefined,
      audioMimeType: undefined,
    };

    this.rawTranscription.textContent = '';
    this.polishedNote.innerHTML = '';
    this.editorTitle.textContent = '';
    this.translationResultsContainer.innerHTML = '';
    this.playRecordingButton.classList.add('hidden');
    
    this.updatePlaceholderState(this.rawTranscription);
    this.updatePlaceholderState(this.polishedNote);
    this.updatePlaceholderState(this.editorTitle);
    this.translationArea.classList.add('hidden');
    this.updateTranslationButtonsState();
    this.updateVoicePlayer();

    this.recordingStatus.textContent = 'Ready to record';

    if (this.isRecording) {
      this.mediaRecorder?.stop();
      this.isRecording = false;
      this.recordButton.classList.remove('recording');
    } else {
      this.stopLiveDisplay();
    }
  }

  private updatePlaceholderState(el: HTMLElement): void {
    const placeholder = el.getAttribute('placeholder')!;
    let currentText =
      el.id === 'polishedNote'
        ? (el as HTMLElement).innerText
        : el.textContent;

    currentText = currentText?.trim();

    if (currentText === '') {
        el.textContent = ''; // Clear it first
        el.classList.add('placeholder-active');
        if (el.id !== 'editorTitle') {
             // For divs that can contain other elements, we set the placeholder as text content.
            (el as HTMLElement).innerText = placeholder;
        }
    } else {
        el.classList.remove('placeholder-active');
    }
  }

  private initContentEditablePlaceholder(el: HTMLElement): void {
    const placeholder = el.getAttribute('placeholder')!;
    
    // Set initial state
    this.updatePlaceholderState(el);

    el.addEventListener('focus', () => {
      if (el.classList.contains('placeholder-active')) {
        el.textContent = '';
        el.classList.remove('placeholder-active');
      }
    });

    el.addEventListener('blur', () => {
      // Don't run this for title, it has its own blur handler
      if(el.id !== 'editorTitle') {
        this.updatePlaceholderState(el);
      }
    });
  }

  private hasVoiceFor(langCode: string): boolean {
    return this.voices.some((v) => v.lang.toLowerCase().startsWith(langCode));
  }

  private showVoicePrompt(language: Language): void {
    if (this.promptedLanguages.has(language)) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instruction = '';
    if(isIOS){
      instruction = `To enable, go to Settings > Accessibility > Spoken Content > Voices, and add the ${language} voice.`
    } else if (isMac) {
      instruction = `To enable, go to System Settings > Accessibility > Spoken Content > System Voice, and add the ${language} voice.`
    } else if (isAndroid) {
      instruction = `To enable, go to Settings > Accessibility > Text-to-speech output. Tap the gear icon for your preferred engine, select "Install voice data", and choose ${language}.`;
    } else {
      instruction = `To enable, go to Windows Settings > Time & Language > Language & region, and add the ${language} language pack.`;
    }

    this.voicePrompt.innerHTML = `
      <p><b>Voice for ${language} not found.</b></p>
      <p>${instruction}</p>
      <button class="voice-prompt-close">&times;</button>
    `;
    this.voicePrompt
      .querySelector('.voice-prompt-close')
      ?.addEventListener('click', () => {
        this.voicePrompt.classList.add('hidden');
      });
    this.voicePrompt.classList.remove('hidden');
    this.promptedLanguages.add(language);
  }

  private speak(text: string, lang: string, button: HTMLButtonElement): void {
    if (!this.speechSynthesis || !text) return;

    if (this.speechSynthesis.speaking) {
      this.speechSynthesis.cancel();
    }
    
    this.speakingButton = button;
    this.updateSpeechButtonIcons();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.voices.find(v => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = lang;
    
    utterance.onend = () => {
      this.speakingButton = null;
      this.updateSpeechButtonIcons();
    };
    utterance.onerror = () => {
      this.speakingButton = null;
      this.updateSpeechButtonIcons();
      console.error("Speech synthesis error");
    };

    this.speechSynthesis.speak(utterance);
  }

  private stopSpeaking(): void {
    if (this.speechSynthesis?.speaking) {
      this.speechSynthesis.cancel();
    }
    this.speakingButton = null;
    this.updateSpeechButtonIcons();
  }

  private updateSpeechButtonIcons(): void {
    const allSpeechButtons = document.querySelectorAll<HTMLButtonElement>('.speech-button');
    allSpeechButtons.forEach(btn => {
      const icon = btn.querySelector('i')!;
      if (btn === this.speakingButton) {
        icon.className = 'fas fa-stop';
        btn.classList.add('speaking');
      } else {
        icon.className = 'fas fa-volume-high';
        btn.classList.remove('speaking');
      }
    });
  }

  private handlePlayRecording(): void {
    if (this.currentNote?.audioData) {
      // Always play the original recording if available
      console.log('🎵 Playing original recorded audio');
      this.playAudioFromBase64(this.currentNote.audioData, this.currentNote.audioMimeType || 'audio/webm');
    } else {
      console.log('⚠️ No original audio data found, cannot play recording');
      this.recordingStatus.textContent = 'No original recording available to play';
      setTimeout(() => {
        this.recordingStatus.textContent = 'Ready to record';
      }, 2000);
    }
  }

  private playAudioFromBase64(base64Data: string, mimeType: string): void {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(base64Data.split(',')[1] || base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Create audio element and play
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      audio.src = url;
      
      // Update button state
      this.playRecordingButton.classList.add('playing');
      this.playRecordingButton.innerHTML = '<i class="fas fa-stop"></i>';
      this.playRecordingButton.title = 'Stop playback';
      
      audio.onended = () => {
        this.resetPlayRecordingButton();
        URL.revokeObjectURL(url);
      };
      
      audio.onerror = () => {
        this.resetPlayRecordingButton();
        URL.revokeObjectURL(url);
        console.error('Error playing audio');
      };
      
      // Add click handler to stop playback
      const stopHandler = () => {
        audio.pause();
        audio.currentTime = 0;
        this.resetPlayRecordingButton();
        URL.revokeObjectURL(url);
        this.playRecordingButton.removeEventListener('click', stopHandler);
      };
      
      this.playRecordingButton.addEventListener('click', stopHandler);
      
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        this.resetPlayRecordingButton();
        URL.revokeObjectURL(url);
      });
      
    } catch (error) {
      console.error('Error converting base64 to audio:', error);
    }
  }

  private resetPlayRecordingButton(): void {
    this.playRecordingButton.classList.remove('playing');
    this.playRecordingButton.innerHTML = '<i class="fas fa-play"></i>';
    this.playRecordingButton.title = 'Play original recording';
  }

  private handleTranslationSpeechClick(lang: Language, text: string, button: HTMLButtonElement): void {
    if (this.speakingButton === button) {
      this.stopSpeaking();
      return;
    }
    
    const langCode = SUPPORTED_LANGUAGES[lang];
    if (!this.hasVoiceFor(langCode)) {
      this.showVoicePrompt(lang);
      return;
    }

    this.speak(text, langCode, button);
  }

  // Raw Voice Player Methods
  private updateVoicePlayer(): void {
    if (this.currentNote?.audioData) {
      this.rawVoicePlayButton.disabled = false;
      this.recordingInfo.textContent = `${this.currentNote.audioMimeType || 'audio'} recording available`;
      this.voicePlayerMessage.style.display = 'none';
    } else {
      this.rawVoicePlayButton.disabled = true;
      this.recordingInfo.textContent = 'No recording available';
      this.voicePlayerMessage.style.display = 'block';
      this.resetVoicePlayer();
    }
  }

  private toggleVoicePlayback(): void {
    if (!this.currentNote?.audioData) return;

    if (this.currentAudio && !this.currentAudio.paused) {
      this.pauseVoicePlayback();
    } else {
      this.startVoicePlayback();
    }
  }

  private startVoicePlayback(): void {
    if (!this.currentNote?.audioData) return;

    if (this.currentAudio) {
      this.currentAudio.play();
      this.updatePlayButton(true);
      return;
    }

    try {
      // Convert base64 to blob
      const base64Data = this.currentNote.audioData.split(',')[1] || this.currentNote.audioData;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: this.currentNote.audioMimeType || 'audio/webm' });
      
      const url = URL.createObjectURL(blob);
      this.currentAudio = new Audio(url);
      this.currentAudio.volume = this.volumeSlider.valueAsNumber / 100;

      this.currentAudio.addEventListener('loadedmetadata', () => {
        this.totalTimeDisplay.textContent = this.formatTime(this.currentAudio!.duration);
      });

      this.currentAudio.addEventListener('timeupdate', () => {
        const progress = (this.currentAudio!.currentTime / this.currentAudio!.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.currentTimeDisplay.textContent = this.formatTime(this.currentAudio!.currentTime);
      });

      this.currentAudio.addEventListener('ended', () => {
        this.resetVoicePlayer();
        URL.revokeObjectURL(url);
      });

      this.currentAudio.addEventListener('error', () => {
        console.error('Error playing audio');
        this.resetVoicePlayer();
        URL.revokeObjectURL(url);
      });

      this.currentAudio.play();
      this.updatePlayButton(true);
    } catch (error) {
      console.error('Error creating audio from base64:', error);
    }
  }

  private pauseVoicePlayback(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.updatePlayButton(false);
    }
  }

  private updatePlayButton(isPlaying: boolean): void {
    const icon = this.rawVoicePlayButton.querySelector('i');
    if (icon) {
      if (isPlaying) {
        icon.className = 'fas fa-pause';
      } else {
        icon.className = 'fas fa-play';
      }
    }
  }

  private resetVoicePlayer(): void {
    this.progressFill.style.width = '0%';
    this.currentTimeDisplay.textContent = '0:00';
    this.updatePlayButton(false);
    if (this.currentAudio) {
      this.currentAudio.currentTime = 0;
    }
  }

  private updateVolume(): void {
    if (this.currentAudio) {
      this.currentAudio.volume = this.volumeSlider.valueAsNumber / 100;
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VoiceNotesApp();
});

export {};