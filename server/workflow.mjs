export const workflowContract = {
  version: '1.0',
  modes: ['default', 'ai'],
  input: {version: '1.0', source: 'URL', title: 'string', candidates: [{id: 'string', name: 'string', type: 'string', text: 'string', desc: 'string', tags: ['string'], score: 'number', rect: 'object', style: 'object'}]},
  output: {version: '1.0', selectedIds: ['candidate id, ordered']},
  fallback: 'Default rules are retained when no adapter is configured, it fails, times out, or returns invalid IDs.',
};

// Images and credentials are deliberately excluded from the workflow boundary.
export function workflowInput(result) {
  return {version: '1.0', source: result.source, title: result.title, candidates: result.fragments.map(f => ({
    id: String(f.id), name: f.name, type: f.type, text: (f.text || '').slice(0, 4000),
    desc: f.desc, tags: f.tags, score: f.score, rect: f.rect, style: f.style,
  }))};
}

export async function runWorkflow(result, {mode = 'default', adapter, timeoutMs = 8000} = {}) {
  if (!['default', 'ai'].includes(mode)) throw new Error('workflow 仅支持 default 或 ai。');
  const base = {version: '1.0', mode, candidateCount: result.fragments.length};
  const fallback = reason => ({...result, workflow: {...base, status: 'fallback', reason, selectedCount: result.fragments.length}});
  if (mode === 'default') return {...result, workflow: {...base, status: 'default', selectedCount: result.fragments.length}};
  if (typeof adapter !== 'function') return fallback('not_configured');
  let timer;
  const controller = new AbortController();
  try {
    // Pass a detached metadata snapshot; an adapter cannot overwrite canonical fragments.
    const input = structuredClone(workflowInput(result));
    const output = await Promise.race([
      Promise.resolve().then(() => adapter(input, {signal: controller.signal})),
      new Promise((_, reject) => {timer = setTimeout(() => {controller.abort(); reject(new Error('timeout'));}, timeoutMs);}),
    ]);
    const ids = output?.selectedIds;
    const byId = new Map(result.fragments.map(f => [String(f.id), f]));
    if (output?.version !== '1.0' || !Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !byId.has(id)) || new Set(ids).size !== ids.length) return fallback('invalid_output');
    return {...result, fragments: ids.map(id => byId.get(id)), workflow: {...base, status: 'applied', selectedIds: ids, selectedCount: ids.length}};
  } catch (error) {
    return fallback(controller.signal.aborted ? 'timeout' : 'adapter_failed');
  } finally {clearTimeout(timer);}
}
