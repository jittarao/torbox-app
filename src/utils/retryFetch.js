export async function retryFetch(fetchFn, { maxRetries = 3, delayMs = 2000, permanent = [] } = {}) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await fetchFn();
      const data = await response.json();

      // Check for permanent failures that shouldn't be retried
      if (!data.success && permanent.some(check => check(data))) {
        return data;
      }

      if (data.success) {
        return data;
      }

      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      retries++;
      if (retries === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Failed after ${maxRetries} retries`);
} 