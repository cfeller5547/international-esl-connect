let runtimeBootstrapPromise: Promise<void> | null = null;

export async function ensureRuntimeBootstrap() {
  if (runtimeBootstrapPromise) {
    return runtimeBootstrapPromise;
  }

  runtimeBootstrapPromise = import("./bootstrap-data")
    .then(({ bootstrapDatabase }) => bootstrapDatabase())
    .catch((error) => {
      runtimeBootstrapPromise = null;
      throw error;
    });

  return runtimeBootstrapPromise;
}
