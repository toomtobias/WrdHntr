/**
 * Game Logic for WrdHntr
 * Handles letter generation, word validation, and scoring
 */

// Swedish word list stored as a Set for O(1) lookups
let wordList = new Set();

// Swedish letter frequencies (biased towards common consonants)
const SWEDISH_LETTERS = {
  vowels: ['A', 'E', 'I', 'O', 'U', 'Y', 'Å', 'Ä', 'Ö'],
  consonants: ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'X', 'Z'],
  // Common Swedish consonants get higher weight
  commonConsonants: ['N', 'R', 'S', 'T', 'L', 'D', 'G', 'M', 'K'],
  // Common Swedish vowels
  commonVowels: ['A', 'E', 'I', 'O']
};

/**
 * Load the Swedish word list from GitHub
 * @returns {Promise<void>}
 */
export async function loadWordList() {
  const url = 'https://raw.githubusercontent.com/martinlindhe/wordlist_swedish/master/swe_wordlist';

  try {
    console.log('Loading Swedish word list...');
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch word list: ${response.status}`);
    }

    const text = await response.text();
    const words = text.split('\n')
      .map(word => word.trim().toUpperCase())
      .filter(word => word.length >= 2);

    wordList = new Set(words);
    console.log(`Loaded ${wordList.size} Swedish words`);
  } catch (error) {
    console.error('Error loading word list:', error);
    // Load a minimal fallback list for testing
    wordList = new Set(['OCH', 'ATT', 'DET', 'SOM', 'HAR', 'MED', 'VAR', 'ETT', 'FÖR', 'PÅ']);
    console.log('Using fallback word list');
  }
}

/**
 * Generate random letters for a game
 * @param {number} count - Number of letters to generate (12-16)
 * @returns {string[]} Array of uppercase letters
 */
export function generateLetters(count = 14) {
  const letters = [];
  const vowelCount = Math.floor(count * 0.35); // ~35% vowels
  const consonantCount = count - vowelCount;

  // Add vowels (bias towards common ones)
  for (let i = 0; i < vowelCount; i++) {
    if (Math.random() < 0.7) {
      // 70% chance of common vowel
      letters.push(SWEDISH_LETTERS.commonVowels[Math.floor(Math.random() * SWEDISH_LETTERS.commonVowels.length)]);
    } else {
      letters.push(SWEDISH_LETTERS.vowels[Math.floor(Math.random() * SWEDISH_LETTERS.vowels.length)]);
    }
  }

  // Add consonants (bias towards common ones)
  for (let i = 0; i < consonantCount; i++) {
    if (Math.random() < 0.6) {
      // 60% chance of common consonant
      letters.push(SWEDISH_LETTERS.commonConsonants[Math.floor(Math.random() * SWEDISH_LETTERS.commonConsonants.length)]);
    } else {
      letters.push(SWEDISH_LETTERS.consonants[Math.floor(Math.random() * SWEDISH_LETTERS.consonants.length)]);
    }
  }

  // Shuffle the letters
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }

  return letters;
}

/**
 * Check if a word can be formed from the given letters
 * @param {string} word - Word to check
 * @param {string[]} availableLetters - Available letters
 * @returns {boolean}
 */
export function canFormWord(word, availableLetters) {
  const letterPool = [...availableLetters];
  const upperWord = word.toUpperCase();

  for (const char of upperWord) {
    const index = letterPool.indexOf(char);
    if (index === -1) {
      return false;
    }
    letterPool.splice(index, 1);
  }

  return true;
}

/**
 * Check if a word exists in the Swedish dictionary
 * @param {string} word - Word to validate
 * @returns {boolean}
 */
export function isValidSwedishWord(word) {
  return wordList.has(word.toUpperCase());
}

/**
 * Validate a word submission
 * @param {string} word - Submitted word
 * @param {string[]} letters - Available letters
 * @param {number} minLength - Minimum word length
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateWord(word, letters, minLength = 3) {
  const upperWord = word.toUpperCase().trim();

  if (!upperWord) {
    return { valid: false, error: 'Tomt ord' };
  }

  if (upperWord.length < minLength) {
    return { valid: false, error: `Ordet måste vara minst ${minLength} bokstäver` };
  }

  if (!canFormWord(upperWord, letters)) {
    return { valid: false, error: 'Ogiltiga bokstäver' };
  }

  if (!isValidSwedishWord(upperWord)) {
    return { valid: false, error: 'Inte ett giltigt svenskt ord' };
  }

  return { valid: true };
}

/**
 * Calculate score for a word in Free-for-all mode
 * @param {string} word - The word
 * @param {number} secondsElapsed - Seconds since game start
 * @returns {number} Score
 */
export function calculateFreeForAllScore(word, secondsElapsed) {
  const wordLength = word.length;
  const timeBonus = Math.max(0, 60 - secondsElapsed);
  let score = wordLength * timeBonus;

  // Bonus for longer words
  if (wordLength > 6) {
    score += 5;
  }

  return Math.round(score);
}

/**
 * Calculate score for a word in Exclusive mode
 * @param {string} word - The word
 * @returns {number} Score (1 point per letter)
 */
export function calculateExclusiveScore(word) {
  return word.length;
}

/**
 * Generate a unique game ID
 * @returns {string} 6-character game ID
 */
export function generateGameId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Get word list size (for debugging)
 * @returns {number}
 */
export function getWordListSize() {
  return wordList.size;
}

/**
 * Find all possible words that can be formed from the given letters
 * @param {string[]} letters - Available letters
 * @param {number} minLength - Minimum word length
 * @returns {string[]} Array of possible words, sorted by length (descending)
 */
export function findPossibleWords(letters, minLength = 3) {
  const possibleWords = [];

  for (const word of wordList) {
    if (word.length >= minLength && canFormWord(word, letters)) {
      possibleWords.push(word);
    }
  }

  // Sort by length (longest first), then alphabetically
  possibleWords.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b, 'sv');
  });

  return possibleWords;
}
