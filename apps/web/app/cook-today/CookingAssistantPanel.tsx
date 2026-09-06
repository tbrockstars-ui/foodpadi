'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { CheckCookingStepResponse, RecipeView } from '@foodpadi/shared';
import styles from './cook-today.module.css';
import { readImageFile } from './imageCapture';
import type { CookingTimerHandle } from './CookingTimer';

// Minimal shape for the non-standard Web Speech API (not in lib.dom.d.ts).
// Chrome/Edge only — every call site feature-detects before using this.
interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => MinimalSpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // don't queue behind a previous answer
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch {
    // Speech synthesis is a nice-to-have — never let it break the flow.
  }
}

interface Props {
  recipe: RecipeView;
  stepIndex: number;
  isLastStep: boolean;
  timerRef: RefObject<CookingTimerHandle>;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
}

/**
 * The "Kitchen Copilot" extras inside a guided-cooking step: a photo-based
 * "Is this ready?" vision check, a typed/voice "Ask FoodPadi" question, and
 * hands-free voice commands (next/back/timer) via the Web Speech API. All
 * three POST to /cooking-assistant/* (member-only — this panel is only
 * rendered for a signed-in cook, never a guest, see CookingSession.tsx).
 */
export function CookingAssistantPanel({ recipe, stepIndex, isLastStep, timerRef, onNext, onBack, onFinish }: Props) {
  const stepText = recipe.steps[stepIndex];

  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckCookingStepResponse | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  // Reset the per-step vision check/answer so a stale result from the
  // previous step never lingers on the new one.
  useEffect(() => {
    setCheckResult(null);
    setCheckError(null);
    setAnswer(null);
    setAskError(null);
    setHeard(null);
  }, [stepIndex]);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;
    setCheckError(null);
    setCheckResult(null);
    setChecking(true);
    try {
      const { base64, mediaType } = await readImageFile(file);
      const res = await fetch('/api/proxy/cooking-assistant/check-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType, recipeTitle: recipe.title, stepText }),
      });
      if (res.status === 401) throw new Error('Sign in again to keep using FoodPadi’s cooking assistant.');
      if (!res.ok) throw new Error("Couldn't check that photo. Please try again.");
      setCheckResult((await res.json()) as CheckCookingStepResponse);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Couldn't check that photo. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const askQuestion = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAskError(null);
    setAnswer(null);
    setAsking(true);
    try {
      const res = await fetch('/api/proxy/cooking-assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeTitle: recipe.title,
          ingredients: recipe.ingredients.map((i) => [i.quantity, i.unit, i.name].filter(Boolean).join(' ')),
          steps: recipe.steps,
          currentStepIndex: stepIndex,
          question: trimmed,
        }),
      });
      if (res.status === 401) throw new Error('Sign in again to keep using FoodPadi’s cooking assistant.');
      if (!res.ok) throw new Error("FoodPadi couldn't answer that just now.");
      const data = (await res.json()) as { answer: string };
      setAnswer(data.answer);
      speak(data.answer);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "FoodPadi couldn't answer that just now.");
    } finally {
      setAsking(false);
    }
  };

  // Simple client-side command grammar — "Next"/"Back"/"Set a timer for 5
  // minutes"/"Pause" are handled locally with zero AI cost; anything else is
  // treated as a spoken question and sent to the Q&A endpoint.
  const handleVoiceCommand = (text: string) => {
    setHeard(text);
    const t = text.trim().toLowerCase();

    if (/^(next|i'?m ready|ready|okay next|go next)\b/.test(t)) {
      onNext();
      return;
    }
    if (/^(back|previous|go back)\b/.test(t)) {
      onBack();
      return;
    }
    if (/^(finish|done|i'?m done|finish cooking)\b/.test(t)) {
      if (isLastStep) onFinish();
      return;
    }
    const timerMatch = t.match(/(?:set a? ?)?timer (?:for )?(\d+)\s*(minute|min|second|sec)/);
    if (timerMatch) {
      const value = parseInt(timerMatch[1], 10);
      const seconds = timerMatch[2].startsWith('sec') ? value : value * 60;
      timerRef.current?.startWithSeconds(seconds);
      return;
    }
    if (/^(start|resume)( the)? timer$/.test(t)) {
      timerRef.current?.startWithSeconds();
      return;
    }
    if (/^pause( the timer)?$/.test(t)) {
      timerRef.current?.pause();
      return;
    }

    void askQuestion(text);
  };

  const startListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = 'en-GB';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) handleVoiceCommand(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  if (!expanded) {
    return (
      <div className={styles.assistantPanel}>
        <button type="button" className={styles.secondaryButton} onClick={() => setExpanded(true)}>
          Need a hand with this step?
        </button>
      </div>
    );
  }

  return (
    <div className={styles.assistantPanel}>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => setExpanded(false)}
        style={{ marginBottom: 'var(--space-md)' }}
      >
        Hide assistant
      </button>

      {voiceSupported ? (
        <div className={styles.assistantRow}>
          <button
            type="button"
            className={`${styles.secondaryButton} ${listening ? styles.chipSelected : ''}`}
            onClick={listening ? stopListening : startListening}
          >
            {listening ? '🎙️ Listening…' : '🎙️ Talk to FoodPadi'}
          </button>
          {heard ? <span className={styles.heardText}>&ldquo;{heard}&rdquo;</span> : null}
        </div>
      ) : null}

      <div className={styles.assistantRow}>
        <label className={styles.secondaryButton} style={{ cursor: 'pointer' }}>
          {checking ? 'Checking…' : '📷 Is this ready?'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handlePhotoChange}
            disabled={checking}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      {checkError ? <p className={styles.errorText}>{checkError}</p> : null}
      {checkResult ? (
        <div className={styles.assistantResult}>
          <p className={styles.stepText}>{checkResult.observation}</p>
          <p className={styles.stepText}>{checkResult.suggestion}</p>
          <p className={styles.safetyNotice}>{checkResult.safetyNote}</p>
        </div>
      ) : null}

      <div className={styles.assistantRow}>
        <input
          className={styles.addInput}
          type="text"
          placeholder="Ask FoodPadi about this step…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && question.trim()) {
              void askQuestion(question);
              setQuestion('');
            }
          }}
          disabled={asking}
        />
        <button
          type="button"
          className={styles.addButton}
          onClick={() => {
            if (question.trim()) {
              void askQuestion(question);
              setQuestion('');
            }
          }}
          disabled={asking || !question.trim()}
        >
          {asking ? '…' : 'Ask'}
        </button>
      </div>
      {askError ? <p className={styles.errorText}>{askError}</p> : null}
      {answer ? <p className={styles.assistantAnswer}>{answer}</p> : null}
    </div>
  );
}
