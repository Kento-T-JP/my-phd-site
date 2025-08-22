export async function unwrapParams<T>(params: Promise<T> | T): Promise<T> {
  return await params;
}
