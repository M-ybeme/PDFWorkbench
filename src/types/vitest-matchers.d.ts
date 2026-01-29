import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toBe(expected: T): void;
    toEqual<E>(expected: E): void;
    toMatchObject<E extends object>(expected: E): void;
    toHaveLength(length: number): void;
    toBeDefined(): void;
    toBeGreaterThan(value: number | bigint): void;
    toBeGreaterThanOrEqual(value: number | bigint): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(times: number): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    toBeInTheDocument(): void;
    toThrow(expected?: unknown): void;
    rejects: {
      toThrow(expected?: unknown): Promise<void>;
    };
  }
}
