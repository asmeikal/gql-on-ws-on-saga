function retryWait(retries: number): number {
  return Math.max(
    1000,
    Math.min(
      10000,
      2 ** (retries - 1) * 1000 + Math.random() * (3000 - 300) + 300
    )
  );
}

export function* exponentialBackoff(): Generator<number, void> {
  let tries = 0;
  while (true) {
    yield retryWait(tries++);
  }
}
