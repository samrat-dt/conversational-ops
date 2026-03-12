export class KeyRotationManager {
  private keys: string[];
  private currentIndex = 0;

  constructor() {
    this.keys = this.loadKeys();
    if (this.keys.length === 0) {
      throw new Error('No Groq API keys found. Set GROQ_API_KEY_1 (and optionally GROQ_API_KEY_2..N) in .env');
    }
  }

  private loadKeys(): string[] {
    const keys: string[] = [];
    let i = 1;
    while (true) {
      const key = process.env[`GROQ_API_KEY_${i}`];
      if (!key) break;
      keys.push(key);
      i++;
    }
    return keys;
  }

  /** Returns the current key and advances the index (round-robin). */
  next(): string {
    const key = this.keys[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return key;
  }

  /** Returns current key without advancing. */
  current(): string {
    return this.keys[this.currentIndex];
  }

  get count(): number {
    return this.keys.length;
  }
}
