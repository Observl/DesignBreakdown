import test from 'node:test';import assert from 'node:assert/strict';
import {isPublicAddress,parseTarget,assertPublicUrl} from '../server/security.mjs';
test('reject loopback, private, metadata, mapped IPv4 and malformed URLs',()=>{
for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','::1','fc00::1','::ffff:127.0.0.1'])assert.equal(isPublicAddress(ip),false,ip);
for(const url of ['file:///etc/passwd','http://localhost','http://127.1','http://2130706433','http://[::1]','http://user:pass@example.com','https://example.com:3000'])assert.throws(()=>parseTarget(url),undefined,url);
assert.equal(isPublicAddress('8.8.8.8'),true);assert.equal(parseTarget('https://example.com/a').pathname,'/a');
});
test('reject mixed DNS records and accept public destinations',async()=>{
await assert.rejects(assertPublicUrl('https://example.com',async()=>[{address:'8.8.8.8'},{address:'10.0.0.1'}]));
assert.equal((await assertPublicUrl('https://example.com',async()=>[{address:'8.8.8.8'}])).hostname,'example.com');
});
