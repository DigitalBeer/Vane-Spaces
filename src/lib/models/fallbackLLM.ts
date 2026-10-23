import z from 'zod';
import BaseLLM from './base/llm';
import {
  GenerateObjectInput,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from './types';
import {
  classifyProviderError,
  errorText,
  ProviderErrorClass,
  shouldFallBack,
} from './providerError';
import { ModelHealthStore } from './modelHealth';

export type FallbackEvent = {
  from: string;
  to: string;
  reason: ProviderErrorClass | 'benched';
};

type FallbackOptions = {
  primary: BaseLLM<any>;
  /** "providerId/modelKey", the key used in the health store. */
  primaryKey: string;
  fallback: BaseLLM<any>;
  fallbackKey: string;
  health: ModelHealthStore;
  onFallback?: (event: FallbackEvent) => void;
};

/**
 * Wraps a chat model so that each call which fails in a way another model
 * could fix (gone, rate-limited, unreachable — see providerError.ts) is retried
 * on a fallback model, and the primary is benched for a while. A benched
 * primary is skipped up front. Bugs and oversized prompts are not masked.
 *
 * Each call falls back independently, so a model that runs out of free quota
 * halfway through a search hands the remaining steps to the fallback. A stream
 * only switches if the primary failed before producing any output.
 */
class FallbackLLM extends BaseLLM<null> {
  private lastServed: BaseLLM<any> | null = null;

  constructor(private readonly opts: FallbackOptions) {
    super(null);
    this.label = opts.primary.label;
  }

  answeredBy() {
    return this.lastServed === this.opts.fallback
      ? { model: this.opts.fallback.label, fallbackFrom: this.opts.primary.label }
      : { model: this.opts.primary.label };
  }

  /** Records which model is serving the current call. */
  private serve(llm: BaseLLM<any>): BaseLLM<any> {
    this.lastServed = llm;
    return llm;
  }

  private useFallbackNow(): boolean {
    if (!this.opts.health.isBenched(this.opts.primaryKey)) return false;
    this.opts.onFallback?.({
      from: this.opts.primaryKey,
      to: this.opts.fallbackKey,
      reason: 'benched',
    });
    return true;
  }

  /** Returns whether the error should hand the call to the fallback. */
  private handleFailure(error: unknown): boolean {
    const cls = classifyProviderError(error);
    if (!shouldFallBack(cls)) return false;
    this.opts.health.markFailed(this.opts.primaryKey, cls, errorText(error));
    console.warn(
      `[fallback] ${this.opts.primaryKey} failed (${cls}); using ${this.opts.fallbackKey}`,
    );
    this.opts.onFallback?.({
      from: this.opts.primaryKey,
      to: this.opts.fallbackKey,
      reason: cls,
    });
    return true;
  }

  private async run<T>(call: (llm: BaseLLM<any>) => Promise<T>): Promise<T> {
    if (this.useFallbackNow()) return call(this.serve(this.opts.fallback));
    try {
      return await call(this.serve(this.opts.primary));
    } catch (error) {
      if (!this.handleFailure(error)) throw error;
      return call(this.serve(this.opts.fallback));
    }
  }

  private async *runStream<T>(
    make: (llm: BaseLLM<any>) => AsyncGenerator<T>,
  ): AsyncGenerator<T> {
    if (this.useFallbackNow()) {
      yield* make(this.serve(this.opts.fallback));
      return;
    }
    let started = false;
    try {
      for await (const chunk of make(this.serve(this.opts.primary))) {
        started = true;
        yield chunk;
      }
    } catch (error) {
      if (started || !this.handleFailure(error)) throw error;
      yield* make(this.serve(this.opts.fallback));
    }
  }

  generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return this.run((llm) => llm.generateText(input));
  }

  streamText(input: GenerateTextInput): AsyncGenerator<StreamTextOutput> {
    return this.runStream((llm) => llm.streamText(input));
  }

  generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>> {
    return this.run((llm) => llm.generateObject<T>(input));
  }

  streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<Partial<z.infer<T>>> {
    return this.runStream((llm) => llm.streamObject<T>(input));
  }
}

export default FallbackLLM;
