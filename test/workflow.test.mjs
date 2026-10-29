import test from 'node:test';
import assert from 'node:assert/strict';
import {runWorkflow, workflowInput} from '../server/workflow.mjs';
import {runWorkflow as edgeWorkflow} from '../edgeone-api/lib/workflow.mjs';

for (const [name, run] of [['node', runWorkflow], ['edgeone', edgeWorkflow]]) {
  const result = {source: 'https://example.com', title: 'Example', screenshot: 'private-image', fragments: [{id: 1, name: 'Header', image: 'image-one'}, {id: 2, name: 'Card', image: 'image-two'}]};
  test(name + ': default extraction remains intact and adapter is opt-in', async () => {
    const out = await run(result, {adapter: () => {throw new Error('should not run');}});
    assert.deepEqual(out.fragments, result.fragments);
    assert.equal(out.workflow.status, 'default');
    assert.equal((await run(result, {mode: 'ai'})).workflow.reason, 'not_configured');
    assert.equal(JSON.stringify(workflowInput(result)).includes('image'), false);
  });
  test(name + ': selection preserves canonical images and accepts an empty selection', async () => {
    const out = await run(result, {mode: 'ai', adapter: async input => {input.candidates[1].name = 'Injected'; return {version: '1.0', selectedIds: ['2', '1']};}});
    assert.equal(out.fragments[0], result.fragments[1]);
    assert.equal(out.fragments[0].name, 'Card');
    assert.deepEqual((await run(result, {mode: 'ai', adapter: async () => ({version: '1.0', selectedIds: []})})).fragments, []);
  });
  test(name + ': invalid output, errors and timeout fall back without losing candidates', async () => {
    for (const output of [{version: '1.0', selectedIds: ['unknown']}, {version: '1.0', selectedIds: ['1', '1']}, {selectedIds: ['1']}, {version: '1.0', selectedIds: [1]}]) {
      const out = await run(result, {mode: 'ai', adapter: async () => output});
      assert.equal(out.workflow.reason, 'invalid_output');
      assert.deepEqual(out.fragments, result.fragments);
    }
    assert.equal((await run(result, {mode: 'ai', adapter: async () => {throw new Error('secret');}})).workflow.reason, 'adapter_failed');
    const out = await run(result, {mode: 'ai', timeoutMs: 5, adapter: () => new Promise(() => {})});
    assert.equal(out.workflow.reason, 'timeout');
    assert.deepEqual(out.fragments, result.fragments);
    await assert.rejects(run(result, {mode: 'unknown'}));
  });
}
