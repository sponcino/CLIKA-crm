export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('Initializing background workers...');
    await import('./lib/queue/workers/meta-message.worker');
    await import('./lib/queue/workers/ai-response.worker');
    await import('./lib/queue/workers/template-send.worker');
  }
}
