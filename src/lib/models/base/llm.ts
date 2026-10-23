import z from 'zod';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../types';
import { ModelLabel } from '../answerInfo';

abstract class BaseLLM<CONFIG> {
  /** Set by the model registry so answers can say which model wrote them. */
  label?: ModelLabel;

  constructor(protected config: CONFIG) {}

  /** The model that served the most recent call. */
  answeredBy(): { model?: ModelLabel; fallbackFrom?: ModelLabel } {
    return { model: this.label };
  }

  abstract generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  abstract streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput>;
  abstract generateObject<T>(input: GenerateObjectInput): Promise<z.infer<T>>;
  abstract streamObject<T>(
    input: GenerateObjectInput,
  ): AsyncGenerator<Partial<z.infer<T>>>;
}

export default BaseLLM;
