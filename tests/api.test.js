'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const port = 3187;
const base = `http://127.0.0.1:${port}`;
const testData = fs.mkdtempSync(path.join(os.tmpdir(), 'manics-api-test-'));
const server = spawn(process.execPath, ['server.js'], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, PORT: String(port), MANICS_DATA_DIR: testData },
  stdio: ['ignore', 'pipe', 'pipe']
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/session`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Test server did not start.');
}

async function request(url, options = {}, cookie = '') {
  const response = await fetch(`${base}${url}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    }
  });
  const type = response.headers.get('content-type') || '';
  const body = type.includes('application/json') ? await response.json() : await response.arrayBuffer();
  return { response, body };
}

test('full authentication, database, authorization, integrity, and file flow', async t => {
  await waitForServer();
  t.after(async () => {
    server.kill();
    if (server.exitCode === null) {
      await new Promise(resolve => server.once('exit', resolve));
    }
    fs.rmSync(testData, { recursive: true, force: true });
  });

  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Manics Ltd/);

  const failedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@manicsgroup.co.za', password: 'wrong' })
  });
  assert.equal(failedLogin.response.status, 401);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@manicsgroup.co.za', password: 'admin123' })
  });
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.body.user.role, 'Administrator');
  assert.equal('password' in adminLogin.body.user, false);
  const adminCookie = adminLogin.response.headers.get('set-cookie').split(';', 1)[0];

  const bootstrap = await request('/api/bootstrap', {}, adminCookie);
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.data.partners.length, 4);
  assert.equal(bootstrap.body.data.deals.length, 5);

  const newPartner = {
    id: 5,
    company_name: 'Automated Test Partner',
    contact_person: 'Test Contact',
    email: 'automated@example.com',
    phone: '',
    address: 'Kigali',
    industry: 'Other',
    status: 'Prospect',
    created_at: new Date().toISOString().slice(0, 10)
  };
  const partnerWrite = await request('/api/collections/partners', {
    method: 'PUT',
    body: JSON.stringify({ data: [...bootstrap.body.data.partners, newPartner] })
  }, adminCookie);
  assert.equal(partnerWrite.response.status, 200);
  assert.equal(partnerWrite.body.data.length, 5);

  const linkedDelete = await request('/api/collections/partners', {
    method: 'PUT',
    body: JSON.stringify({ data: partnerWrite.body.data.filter(partner => partner.id !== 1) })
  }, adminCookie);
  assert.equal(linkedDelete.response.status, 409);

  const employeeLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'john@manicsgroup.co.za', password: 'employee123' })
  });
  const employeeCookie = employeeLogin.response.headers.get('set-cookie').split(';', 1)[0];
  const forbiddenWrite = await request('/api/collections/partners', {
    method: 'PUT',
    body: JSON.stringify({ data: partnerWrite.body.data })
  }, employeeCookie);
  assert.equal(forbiddenWrite.response.status, 403);

  const contract = {
    id: 4,
    deal_id: 1,
    contract_name: 'Automated Upload Contract',
    contract_number: 'MG-AUTO-004',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    status: 'Active',
    file: 'test.pdf',
    file_name: 'test.pdf',
    file_data: 'data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK',
    created_at: new Date().toISOString().slice(0, 10)
  };
  const contractWrite = await request('/api/collections/contracts', {
    method: 'PUT',
    body: JSON.stringify({ data: [...bootstrap.body.data.contracts, contract] })
  }, adminCookie);
  assert.equal(contractWrite.response.status, 200);
  assert.equal(contractWrite.body.data.find(item => item.id === 4).file, 'test.pdf');

  const download = await request('/api/contracts/4/file', {}, adminCookie);
  assert.equal(download.response.status, 200);
  assert.equal(download.response.headers.get('content-type'), 'application/pdf');
  assert.ok(download.body.byteLength > 0);
});
