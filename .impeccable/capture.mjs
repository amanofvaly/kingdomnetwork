import fs from 'node:fs';

const [width, height, output, url = 'http://127.0.0.1:4173/', expression] = process.argv.slice(2);
const tabs = await fetch('http://127.0.0.1:9333/json').then((r) => r.json());
const tab = tabs.find((item) => item.type === 'page');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
const send = (method, params = {}) => new Promise((resolve) => { const id = ++nextId; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) < 600 });
await send('Page.navigate', { url });
await new Promise((resolve) => setTimeout(resolve, 1800));
if (expression) {
  await send('Runtime.evaluate', { expression });
  await new Promise((resolve) => setTimeout(resolve, 500));
}
const metrics = await send('Runtime.evaluate', { expression: '({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})', returnByValue: true });
const page = metrics.result.result.value;
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: page.width, height: page.height, scale: 1 } });
fs.writeFileSync(output, Buffer.from(shot.result.data, 'base64'));
console.log(JSON.stringify(page));
socket.close();
