declare module 'fit-file-parser' {
  export interface FitParserOptions {
    force?: boolean;
    mode?: 'both' | 'list' | 'object';
    speedUnit?: string;
    elapsedRecordField?: boolean;
  }

  export interface FitMessages {
    record?: Array<Record<string, any>>;
    session?: Array<Record<string, any>>;
    lap?: Array<Record<string, any>>;
    activity?: Array<Record<string, any>>;
    event?: Array<Record<string, any>>;
    file_id?: Array<Record<string, any>>;
    [key: string]: any;
  }

  export interface FitParseResult {
    messages: FitMessages;
  }

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(data: Buffer, callback: (error: Error | null, result: FitParseResult) => void): void;
  }
}

declare module '@markw65/fit-file-writer' {
  export class FitWriter {
    time(date: Date): number;
    latlng(value: number): number;
    writeMessage(
      messageKind: string,
      messageFields: Record<string, any>,
      developerFields?: any[] | null,
      lastUse?: boolean
    ): void;
    finish(): DataView;
  }

  export function keysOf(message: string): string[];
}
