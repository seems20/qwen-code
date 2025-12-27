/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { t, ta } from '../../i18n/index.js';

export const WITTY_LOADING_PHRASES: string[] = [
  // 编程/技术相关
  'Summoning the soul of programmers...',
  "Fixing that bug that's not a bug, it's a feature...",
  'Removing pinyin comments from code...',
  'Debating whether array index starts from 0 or 1...',
  'Thinking about refactoring...',
  'Looking for a misplaced semicolon...',
  'Cleaning up stack overflow...',
  'Naming variables properly...',
  'Commenting code written 3 months ago...',
  'Praying for no bugs...',
  'Trying to exit Vim...',
  'Searching for the correct USB orientation...',
  "That's not a bug, it's an undocumented feature...",
  'Polishing the algorithms...',
  'Compiling brilliance...',
  'Untangling neural nets...',
  'Garbage collecting... be right back...',
  'Resolving dependencies...',
  'Converting coffee into code...',
  // 工作/职场相关
  'Waiting for product manager to change requirements...',
  'Postponing project deadline...',
  'Preparing another "almost done"...',
  'Taking a break...',
  'Making goji berry tea...',
  'Ordering takeout...',
  'Pretending to be busy...',
  // 互联网文化/梗
  'Recharging faith...',
  'Downloading more RAM...',
  'Feeding the server...',
  'Waking up sleeping code...',
  'Feeding data to AI...',
  'Opening imagination...',
  // 日常生活
  'Boiling water for tea...',
  'Waiting for the elevator...',
  'Taking a number in queue...',
  'Waiting for traffic light...',
  'Charging...',
  'Buffering life...',
  // 轻松幽默
  'Contemplating the meaning of life...',
  'What to eat today? Thinking...',
  'Pretending to work...',
  'Let me think, just a moment...',
  'Brewing inspiration...',
  'Take a deep breath, almost done...',
  "Don't worry, good things take time...",
  'Stay calm, exciting things coming...',
  'Hmmm... let me think...',
  // 技术向但接地气
  'Greeting the server...',
  'Organizing thoughts...',
  'Preparing my words...',
  'Looking up information...',
  'Sorting out my thoughts...',
  'Analyzing the problem...',
  'Looking for the best solution...',
  'Engaging cognitive processors...',
  'Crafting a response worthy of your patience...',
  // 保持通用性
  'Loading...',
  'Processing, please wait...',
  'Almost there...',
  'Working hard...',
  'Almost... almost...',
  'Almost there... probably...',
];

export const PHRASE_CHANGE_INTERVAL_MS = 15000;

/**
 * Custom hook to manage cycling through loading phrases.
 * @param isActive Whether the phrase cycling should be active.
 * @param isWaiting Whether to show a specific waiting phrase.
 * @returns The current loading phrase.
 */
export const usePhraseCycler = (
  isActive: boolean,
  isWaiting: boolean,
  customPhrases?: string[],
) => {
  // Get phrases from translations if available
  const loadingPhrases = useMemo(() => {
    if (customPhrases && customPhrases.length > 0) {
      return customPhrases;
    }
    const translatedPhrases = ta('WITTY_LOADING_PHRASES');
    return translatedPhrases.length > 0
      ? translatedPhrases
      : WITTY_LOADING_PHRASES;
  }, [customPhrases]);

  const [currentLoadingPhrase, setCurrentLoadingPhrase] = useState(
    loadingPhrases[0],
  );
  const phraseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isWaiting) {
      setCurrentLoadingPhrase(t('Waiting for user confirmation...'));
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    } else if (isActive) {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
      }
      // Select an initial random phrase
      const initialRandomIndex = Math.floor(
        Math.random() * loadingPhrases.length,
      );
      setCurrentLoadingPhrase(loadingPhrases[initialRandomIndex]);

      phraseIntervalRef.current = setInterval(() => {
        // Select a new random phrase
        const randomIndex = Math.floor(Math.random() * loadingPhrases.length);
        setCurrentLoadingPhrase(loadingPhrases[randomIndex]);
      }, PHRASE_CHANGE_INTERVAL_MS);
    } else {
      // Idle or other states, clear the phrase interval
      // and reset to the first phrase for next active state.
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
      setCurrentLoadingPhrase(loadingPhrases[0]);
    }

    return () => {
      if (phraseIntervalRef.current) {
        clearInterval(phraseIntervalRef.current);
        phraseIntervalRef.current = null;
      }
    };
  }, [isActive, isWaiting, loadingPhrases]);

  return currentLoadingPhrase;
};
