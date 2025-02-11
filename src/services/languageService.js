import i18n from 'i18next';
import { addLanguage } from '@/i18n';
import { extraLanguages } from '@/pages/ExtraLanguages';
import { toast } from 'sonner';

const { electron } = window;

// Event listeners for translation progress
const progressListeners = new Set();
let currentTranslation = null;

// Listen for translation progress updates
electron.ipcRenderer.on('translation-progress', (event, progress) => {
    if (progress) {
        currentTranslation = progress;
        progressListeners.forEach(listener => listener(progress));
        
        // Handle completion and errors
        if (progress.phase === "completed") {
            toast.success(i18n.t("Language downloaded successfully"));
            currentTranslation = null;
            progressListeners.forEach(listener => listener(null));
        } else if (progress.phase === "error") {
            toast.error(i18n.t("Failed to download language"));
            currentTranslation = null;
            progressListeners.forEach(listener => listener(null));
        }
    }
});

/**
 * Get the current translation progress if any
 * @returns {Object|null} Current translation progress or null if no translation is active
 */
export const getCurrentTranslation = () => currentTranslation;

/**
 * Subscribe to translation progress updates
 * @param {function} listener - Callback function that receives progress updates
 * @returns {function} Unsubscribe function
 */
export const onTranslationProgress = (listener) => {
    progressListeners.add(listener);
    // Send current translation state immediately if exists
    if (currentTranslation) {
        listener(currentTranslation);
    }
    return () => progressListeners.delete(listener);
};

// Event emitter for language list changes
const languageListeners = new Set();

/**
 * Subscribe to language list changes
 * @param {function} listener - Callback function that receives updates
 * @returns {function} Unsubscribe function
 */
export const onLanguageListChange = (listener) => {
    languageListeners.add(listener);
    return () => languageListeners.delete(listener);
};

// Notify listeners of language list changes
const notifyLanguageListChange = () => {
    languageListeners.forEach(listener => listener());
};

/**
 * Downloads and registers a new language translation from the Ascendara API
 * @param {string} languageCode - The language code to download (e.g., 'fr', 'de')
 * @returns {Promise<void>}
 */
export const downloadLanguage = async (languageCode) => {
    try {
        // First check if we have it cached in the languages folder
        let translation = await electron.getLanguageFile(languageCode);
        
        // Check for language file in the languages folder ({id}.json)
        if (!translation) {
            try {
                translation = await electron.readLanguageFile(`${languageCode}.json`);
            } catch (err) {
                // File doesn't exist in languages folder, proceed with download
            }
        }
        
        if (!translation) {
            // Don't start a new translation if one is in progress
            if (currentTranslation) {
                toast.error(i18n.t("A translation is already in progress"));
                throw new Error('A translation is already in progress');
            }
            
            // Start the translation process
            currentTranslation = { languageCode, phase: 'starting', progress: 0 };
            progressListeners.forEach(listener => listener(currentTranslation));
            await electron.startTranslation(languageCode);
            return null;
        }

        // If we have a translation, add it right away
        i18n.addResourceBundle(languageCode, 'translation', translation, true, true);
        
        // Add language to available languages if it's an extra language
        if (extraLanguages[languageCode]) {
            const { name, nativeName } = extraLanguages[languageCode];
            addLanguage(languageCode, name, nativeName);
        }
        
        return translation;
    } catch (error) {
        console.error(`Failed to download language ${languageCode}:`, error);
        currentTranslation = null;
        progressListeners.forEach(listener => listener(null));
        throw error;
    }
};

/**
 * Cancel an ongoing translation process
 */
export const cancelTranslation = async () => {
    try {
        if (currentTranslation) {
            await electron.cancelTranslation();
            toast.info(i18n.t("Translation cancelled"));
            currentTranslation = null;
            progressListeners.forEach(listener => listener(null));
        }
    } catch (error) {
        console.error('Failed to cancel translation:', error);
        toast.error(i18n.t("Failed to cancel translation"));
        throw error;
    }
};

/**
 * Checks if a language is already loaded in i18n
 * @param {string} languageCode - The language code to check
 * @returns {boolean}
 */
export const isLanguageLoaded = (languageCode) => {
    return i18n.hasResourceBundle(languageCode, 'translation');
};

/**
 * Changes the application language, downloading it first if necessary
 * @param {string} languageCode - The language code to switch to
 * @returns {Promise<void>}
 */
export const changeLanguage = async (languageCode) => {
    try {
        // If the language isn't loaded yet, start the download
        if (!isLanguageLoaded(languageCode)) {
            await downloadLanguage(languageCode);
            
            // Wait for translation to complete via progress events
            return new Promise((resolve, reject) => {
                const unsubscribe = onTranslationProgress((progress) => {
                    if (progress?.phase === "completed") {
                        unsubscribe();
                        electron.getLanguageFile(languageCode)
                            .then(translation => {
                                i18n.addResourceBundle(languageCode, 'translation', translation, true, true);
                                
                                // Add language to available languages if it's an extra language
                                if (extraLanguages[languageCode]) {
                                    const { name, nativeName } = extraLanguages[languageCode];
                                    addLanguage(languageCode, name, nativeName);
                                    // Notify listeners that the language list has changed
                                    notifyLanguageListChange();
                                }
                                
                                // Change language after a small delay to ensure UI updates
                                setTimeout(() => {
                                    i18n.changeLanguage(languageCode);
                                }, 0);
                                resolve();
                            })
                            .catch(reject);
                    } else if (progress?.phase === "error") {
                        unsubscribe();
                        reject(new Error("Translation failed"));
                    }
                });
            });
        }
        
        // If language is already loaded, just change it
        await i18n.changeLanguage(languageCode);
    } catch (error) {
        console.error(`Failed to change language to ${languageCode}:`, error);
        throw error;
    }
};

/**
 * Updates the language setting and changes the application language
 * @param {string} languageValue - The language code to switch to
 * @returns {Promise<void>}
 */
export const handleLanguageChange = async (languageValue) => {
    const value = String(languageValue);
    try {
        // First update the setting
        const success = await electron.updateSetting('language', value);
        if (!success) {
            throw new Error('Failed to save language setting');
        }
        // Then change the language
        await changeLanguage(value);
    } catch (error) {
        console.error('Error changing language:', error);
        toast.error('Failed to change language');
        throw error;
    }
};

const baseLanguages = {
    "en": { name: "English", nativeName: "English", icon: "🇺🇸" },
    "es": { name: "Español", nativeName: "Español", icon: "🇪🇸" },
    "fr": { name: "Français", nativeName: "Français", icon: "🇫🇷" },
    "it": { name: "Italiano", nativeName: "Italiano", icon: "🇮🇹" },
    "de": { name: "Deutsch", nativeName: "Deutsch", icon: "🇩🇪" },
    "pt": { name: "Português", nativeName: "Português", icon: "🇵🇹" },
    "ru": { name: "Русский", nativeName: "Русский", icon: "🇷🇺" },
    "zh-CN": { name: "中文", nativeName: "中文", icon: "🇨🇳" },
    "ar": { name: "العربية", nativeName: "العربية", icon: "🇸🇦" },
    "hi": { name: "हिन्दी", nativeName: "हिन्दी", icon: "🇮🇳" },
    "bn": { name: "বাংলা", nativeName: "বাংলা", icon: "🇧🇩" },
    "ja": { name: "日本語", nativeName: "日本語", icon: "🇯🇵" }
};

/**
 * Get list of downloaded language files
 * @returns {Promise<Array<string>>} Array of language codes that are downloaded
 */
export const getDownloadedLanguages = async () => {
    try {
        return await electron.getDownloadedLanguages();
    } catch (error) {
        console.error('Failed to get downloaded languages:', error);
        return [];
    }
};

/**
 * Get list of available languages
 * @returns {Promise<Array>} Array of language objects with id, name, and icon
 */
export const getAvailableLanguages = async () => {
    try {
        // Get base languages
        const base = Object.entries(baseLanguages).map(([id, { name, nativeName, icon }]) => ({
            id,
            name: nativeName || name,
            nativeName,
            icon
        }));

        // Get downloaded languages
        const downloaded = await getDownloadedLanguages();
        const extraLangs = downloaded
            .filter(id => !baseLanguages[id]) // Filter out base languages
            .map(id => {
                const info = extraLanguages[id] || { 
                    name: id.toUpperCase(), 
                    nativeName: id.toUpperCase(),
                    icon: "🌐" // Default icon for extra languages
                };
                return {
                    id,
                    name: info.nativeName || info.name,
                    nativeName: info.nativeName,
                    icon: info.icon || "🌐" // Use provided icon or default
                };
            });

        return [...base, ...extraLangs];
    } catch (error) {
        console.error('Failed to get available languages:', error);
        return Object.entries(baseLanguages).map(([id, { name, nativeName, icon }]) => ({
            id,
            name: nativeName || name,
            nativeName,
            icon
        }));
    }
};

export { baseLanguages };
