export function createMutationQueue() {
  let queue = Promise.resolve();

  return async function runMutation<T>(mutation: () => Promise<T>) {
    const previousMutation = queue;
    let releaseMutation = () => {};

    queue = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });

    await previousMutation;

    try {
      return await mutation();
    } finally {
      releaseMutation();
    }
  };
}
