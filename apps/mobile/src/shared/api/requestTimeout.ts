export class RequestTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Request exceeded ${timeoutMs}ms`);
    this.name = "RequestTimeoutError";
  }
}

export const withRequestTimeout = <T>(request: PromiseLike<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new RequestTimeoutError(timeoutMs)), timeoutMs);

    Promise.resolve(request).then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
