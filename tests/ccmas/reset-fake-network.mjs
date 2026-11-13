// Used only by the isolated reset rehearsal. All unexpected outbound HTTP fails closed.
let present = true;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith('https://ai.akadverse.test/')) {
    if (init?.method === 'DELETE' && process.env.RESET_REHEARSAL_FAIL_AI === '1') return new Response(null, { status: 503 });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (url.endsWith('/status')) return new Response(null, { status: 404 });
  }
  if (url.startsWith('https://storage.akadverse.test/storage/v1/')) {
    if (init?.method === 'DELETE') { present = false; return Response.json([]); }
    if (url.includes('/object/info/')) return present ? Response.json({ size: 8 }) : new Response(null, { status: 404 });
  }
  throw new Error('Unexpected HTTP in isolated reset rehearsal');
};
