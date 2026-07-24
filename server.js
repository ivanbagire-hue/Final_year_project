'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DATA_DIR = process.env.MANICS_DATA_DIR ? path.resolve(process.env.MANICS_DATA_DIR) : path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'manics.sqlite');
const PORT = Number(process.env.PORT || 3000);
const SESSION_DAYS = 1;
const MAX_BODY = 8 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

function transaction(work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  fullname TEXT NOT NULL CHECK(length(trim(fullname)) BETWEEN 2 AND 100),
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('Administrator','Manager','Employee','Business Partner')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT 'Other',
  status TEXT NOT NULL CHECK(status IN ('Active','Inactive','Prospect')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  deal_name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount >= 0),
  status TEXT NOT NULL CHECK(status IN ('New','Negotiation','Approved','Rejected','Completed')),
  start_date TEXT,
  end_date TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  CHECK(end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY,
  deal_id INTEGER REFERENCES deals(id) ON DELETE RESTRICT,
  contract_name TEXT NOT NULL,
  contract_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL CHECK(status IN ('Active','Expired','Pending','Renewed')),
  file_name TEXT,
  file_path TEXT,
  file_type TEXT,
  created_at TEXT NOT NULL,
  CHECK(end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  meeting_date TEXT,
  type TEXT NOT NULL CHECK(type IN ('Meeting','Email','Call','Note')),
  participants TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📌',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  report_name TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  generated_date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deals_partner ON deals(partner_id);
CREATE INDEX IF NOT EXISTS idx_contracts_deal ON contracts(deal_id);
CREATE INDEX IF NOT EXISTS idx_comms_partner ON communications(partner_id);
`;
db.exec(schema);

function dateOnly(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [algorithm, salt, expected] = String(stored).split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count) return;
  transaction(() => {
    const insertUser = db.prepare(`
      INSERT INTO users(id,fullname,email,password_hash,role,active,created_at)
      VALUES(?,?,?,?,?,?,?)
    `);
    insertUser.run(1, 'Admin User', 'admin@manicsgroup.co.za', hashPassword('admin123'), 'Administrator', 1, dateOnly(-400));
    insertUser.run(2, 'Sarah Manager', 'sarah@manicsgroup.co.za', hashPassword('manager123'), 'Manager', 1, dateOnly(-300));
    insertUser.run(3, 'John Employee', 'john@manicsgroup.co.za', hashPassword('employee123'), 'Employee', 1, dateOnly(-200));

    const insertPartner = db.prepare(`
      INSERT INTO partners(id,company_name,contact_person,email,phone,address,industry,status,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    `);
    insertPartner.run(1, 'BakePro Supplies', 'Alice Dlamini', 'alice@bakepro.co.za', '+27 11 234 5678', 'Johannesburg, GP', 'Baking', 'Active', dateOnly(-180));
    insertPartner.run(2, 'FlourMill Rwanda', 'James Mugabo', 'james@flourmill.rw', '+250 788 123 456', 'Kigali, Rwanda', 'Milling', 'Active', dateOnly(-150));
    insertPartner.run(3, 'Namibia Foods Ltd', 'Maria Shikongo', 'maria@namibiafoods.na', '+264 61 987654', 'Windhoek, Namibia', 'Food & Beverage', 'Prospect', dateOnly(-90));
    insertPartner.run(4, 'DairyFresh SA', 'Peter Nkosi', 'peter@dairyfresh.co.za', '+27 21 345 6789', 'Cape Town, WC', 'Dairy', 'Inactive', dateOnly(-70));

    const insertDeal = db.prepare(`
      INSERT INTO deals(id,partner_id,deal_name,amount,status,start_date,end_date,description,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    `);
    insertDeal.run(1, 1, 'Baking Premix Supply', 16250000, 'Approved', dateOnly(-30), dateOnly(90), 'Quarterly supply of baking premixes and emulsifiers.', dateOnly(-45));
    insertDeal.run(2, 2, 'Flour Fortification Export', 11700000, 'Negotiation', dateOnly(15), dateOnly(180), 'Vitamin premixes for wheat flour fortification.', dateOnly(-20));
    insertDeal.run(3, 3, 'Namibia Market Entry', 6175000, 'New', dateOnly(30), dateOnly(150), 'Initial market entry deal for the Bakersfest brand.', dateOnly(-10));
    insertDeal.run(4, 1, 'Food Colorants Annual Contract', 20800000, 'Completed', dateOnly(-400), dateOnly(-40), 'Annual supply of food colorants and flavours.', dateOnly(-420));
    insertDeal.run(5, 4, 'Dairy Stabilizers Pilot', 2925000, 'Rejected', dateOnly(-120), dateOnly(-60), 'Pilot supply of stabilizers for dairy products.', dateOnly(-130));

    const insertContract = db.prepare(`
      INSERT INTO contracts(id,deal_id,contract_name,contract_number,start_date,end_date,status,created_at)
      VALUES(?,?,?,?,?,?,?,?)
    `);
    insertContract.run(1, 1, 'BakePro Supply Agreement', `MG-${new Date().getFullYear()}-001`, dateOnly(-30), dateOnly(90), 'Active', dateOnly(-35));
    insertContract.run(2, 2, 'Rwanda Fortification Export MOU', `MG-${new Date().getFullYear()}-002`, dateOnly(15), dateOnly(180), 'Pending', dateOnly(-15));
    insertContract.run(3, 4, 'Food Colorants Contract', `MG-${new Date().getFullYear() - 1}-001`, dateOnly(-400), dateOnly(-40), 'Expired', dateOnly(-420));

    const insertComm = db.prepare(`
      INSERT INTO communications(id,partner_id,subject,message,meeting_date,type,participants,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)
    `);
    insertComm.run(1, 1, 'Delivery Schedule Review', 'Review delivery timelines and logistics for the next premix supply.', dateOnly(7), 'Meeting', 'Admin User, Alice Dlamini', 'Admin User', dateOnly(-2));
    insertComm.run(2, 2, 'Export Documentation Follow-up', 'Sent required export documentation and compliance certificates.', null, 'Email', 'Sarah Manager, James Mugabo', 'Sarah Manager', dateOnly(-1));
    insertComm.run(3, 3, 'Market Introduction Call', 'Introductory call to discuss brand positioning in Namibia.', dateOnly(14), 'Call', 'Admin User, Maria Shikongo', 'Admin User', dateOnly());

    const insertActivity = db.prepare('INSERT INTO activities(id,text,icon,created_at) VALUES(?,?,?,?)');
    insertActivity.run(1, 'New partner BakePro Supplies added', '🤝', new Date(Date.now() - 2 * 3600000).toISOString());
    insertActivity.run(2, 'Deal "Flour Fortification Export" moved to Negotiation', '📋', new Date(Date.now() - 5 * 3600000).toISOString());
    insertActivity.run(3, `Contract MG-${new Date().getFullYear()}-002 created`, '📄', new Date(Date.now() - 86400000).toISOString());
  });
}
seedDatabase();

const tables = {
  users: ['id','fullname','email','role','active','created_at'],
  partners: ['id','company_name','contact_person','email','phone','address','industry','status','created_at'],
  deals: ['id','partner_id','deal_name','amount','status','start_date','end_date','description','created_at'],
  contracts: ['id','deal_id','contract_name','contract_number','start_date','end_date','status','file_name','created_at'],
  communications: ['id','partner_id','subject','message','meeting_date','type','participants','created_by','created_at'],
  activities: ['id','text','icon','created_at'],
  reports: ['id','report_name','generated_by','generated_date']
};

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullname: row.fullname,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    created_at: row.created_at
  };
}

function rows(name) {
  if (!tables[name]) throw new Error('Unknown resource.');
  if (name === 'contracts') {
    db.prepare("UPDATE contracts SET status='Expired' WHERE status='Active' AND end_date IS NOT NULL AND end_date<?").run(dateOnly());
  }
  const result = db.prepare(`SELECT ${tables[name].join(',')} FROM ${name} ORDER BY id`).all();
  if (name === 'users') return result.map(publicUser);
  if (name === 'contracts') return result.map(x => ({ ...x, file: x.file_name }));
  if (name === 'activities') {
    return result.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(x => ({
      ...x,
      time: relativeTime(x.created_at)
    }));
  }
  return result;
}

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute(s) ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour(s) ago`;
  return `${Math.floor(seconds / 86400)} day(s) ago`;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

function currentUser(req) {
  const token = parseCookies(req).manics_session;
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.active=1
  `).get(tokenHash, new Date().toISOString());
  return publicUser(row);
}

function json(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function error(res, status, message) {
  json(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request is too large.'), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON body.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function cleanText(value, name, { required = false, max = 5000 } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw Object.assign(new Error(`${name} is required.`), { status: 400 });
  if (text.length > max) throw Object.assign(new Error(`${name} is too long.`), { status: 400 });
  if (/[<>]/.test(text)) throw Object.assign(new Error(`${name} cannot contain HTML markup.`), { status: 400 });
  return text;
}

function validEmail(value) {
  const email = cleanText(value, 'Email', { required: true, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
  return email;
}

function validDate(value, name, required = false) {
  const text = cleanText(value, name, { required, max: 10 });
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw Object.assign(new Error(`${name} must be a valid date.`), { status: 400 });
  }
  return text;
}

function validForeignId(value, name, required = true) {
  if ((value === null || value === undefined || value === '') && !required) return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error(`${name} is required.`), { status: 400 });
  return id;
}

function requireRole(user, roles) {
  if (!user) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  if (!roles.includes(user.role)) throw Object.assign(new Error('You do not have permission for this action.'), { status: 403 });
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const expected = `http://${req.headers.host}`;
  if (origin !== expected) throw Object.assign(new Error('Invalid request origin.'), { status: 403 });
}

function writeUpload(record, previous) {
  if (!record.file_data) return previous || {};
  const match = String(record.file_data).match(/^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,(.+)$/);
  if (!match) throw Object.assign(new Error('Only PDF, DOC, and DOCX contract files are accepted.'), { status: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) throw Object.assign(new Error('Contract files must be 5 MB or smaller.'), { status: 400 });
  const extension = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  }[match[1]];
  const storageName = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storageName), buffer, { flag: 'wx' });
  return {
    file_name: cleanText(record.file_name || record.file, 'File name', { max: 255 }),
    file_path: storageName,
    file_type: match[1]
  };
}

function validateRecord(name, record, existing = null) {
  const today = dateOnly();
  const id = Number(record.id);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error('Invalid record ID.'), { status: 400 });
  if (name === 'users') {
    const result = {
      id,
      fullname: cleanText(record.fullname, 'Full name', { required: true, max: 100 }),
      email: validEmail(record.email),
      role: cleanText(record.role, 'Role', { required: true, max: 30 }),
      active: record.active === true || record.active === 1 ? 1 : 0,
      created_at: validDate(record.created_at, 'Created date') || existing?.created_at || today
    };
    if (!['Administrator','Manager','Employee','Business Partner'].includes(result.role)) throw Object.assign(new Error('Invalid role.'), { status: 400 });
    if (record.password !== undefined) {
      if (String(record.password).length < 8) throw Object.assign(new Error('Passwords must contain at least 8 characters.'), { status: 400 });
      result.password_hash = hashPassword(String(record.password));
    } else if (existing) result.password_hash = existing.password_hash;
    else throw Object.assign(new Error('A password is required for new users.'), { status: 400 });
    return result;
  }
  if (name === 'partners') {
    return {
      id,
      company_name: cleanText(record.company_name, 'Company name', { required: true, max: 150 }),
      contact_person: cleanText(record.contact_person, 'Contact person', { required: true, max: 100 }),
      email: validEmail(record.email),
      phone: cleanText(record.phone, 'Phone', { max: 40 }),
      address: cleanText(record.address, 'Address', { max: 250 }),
      industry: cleanText(record.industry || 'Other', 'Industry', { required: true, max: 80 }),
      status: ['Active','Inactive','Prospect'].includes(record.status) ? record.status : 'Prospect',
      created_at: validDate(record.created_at, 'Created date') || existing?.created_at || today
    };
  }
  if (name === 'deals') {
    const start = validDate(record.start_date, 'Start date');
    const end = validDate(record.end_date, 'End date');
    if (start && end && end < start) throw Object.assign(new Error('End date cannot be before start date.'), { status: 400 });
    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount < 0) throw Object.assign(new Error('Amount must be zero or greater.'), { status: 400 });
    return {
      id,
      partner_id: validForeignId(record.partner_id, 'Partner'),
      deal_name: cleanText(record.deal_name, 'Deal name', { required: true, max: 160 }),
      amount,
      status: ['New','Negotiation','Approved','Rejected','Completed'].includes(record.status) ? record.status : 'New',
      start_date: start,
      end_date: end,
      description: cleanText(record.description, 'Description', { max: 3000 }),
      created_at: validDate(record.created_at, 'Created date') || existing?.created_at || today
    };
  }
  if (name === 'contracts') {
    const start = validDate(record.start_date, 'Start date');
    const end = validDate(record.end_date, 'End date');
    if (start && end && end < start) throw Object.assign(new Error('End date cannot be before start date.'), { status: 400 });
    const file = writeUpload(record, existing && {
      file_name: existing.file_name,
      file_path: existing.file_path,
      file_type: existing.file_type
    });
    return {
      id,
      deal_id: validForeignId(record.deal_id, 'Linked deal', false),
      contract_name: cleanText(record.contract_name, 'Contract name', { required: true, max: 180 }),
      contract_number: cleanText(record.contract_number, 'Contract number', { required: true, max: 60 }),
      start_date: start,
      end_date: end,
      status: ['Active','Expired','Pending','Renewed'].includes(record.status) ? record.status : 'Pending',
      ...file,
      created_at: validDate(record.created_at, 'Created date') || existing?.created_at || today
    };
  }
  if (name === 'communications') {
    return {
      id,
      partner_id: validForeignId(record.partner_id, 'Partner'),
      subject: cleanText(record.subject, 'Subject', { required: true, max: 180 }),
      message: cleanText(record.message, 'Message', { required: true, max: 5000 }),
      meeting_date: validDate(record.meeting_date, 'Meeting date'),
      type: ['Meeting','Email','Call','Note'].includes(record.type) ? record.type : 'Note',
      participants: cleanText(record.participants, 'Participants', { max: 500 }),
      created_by: cleanText(record.created_by, 'Created by', { required: true, max: 100 }),
      created_at: validDate(record.created_at, 'Created date') || existing?.created_at || today
    };
  }
  if (name === 'activities') {
    return {
      id,
      text: cleanText(record.text, 'Activity', { required: true, max: 500 }),
      icon: cleanText(record.icon || '📌', 'Icon', { required: true, max: 10 }),
      created_at: existing?.created_at || new Date().toISOString()
    };
  }
  if (name === 'reports') {
    return {
      id,
      report_name: cleanText(record.report_name, 'Report name', { required: true, max: 200 }),
      generated_by: cleanText(record.generated_by, 'Generated by', { required: true, max: 100 }),
      generated_date: validDate(record.generated_date, 'Generated date') || today
    };
  }
  throw Object.assign(new Error('Unknown resource.'), { status: 404 });
}

function syncCollection(name, records, user) {
  if (!tables[name] || !Array.isArray(records)) throw Object.assign(new Error('Invalid collection.'), { status: 400 });
  const mutationRoles = {
    users: ['Administrator'],
    partners: ['Administrator','Manager'],
    deals: ['Administrator','Manager'],
    contracts: ['Administrator','Manager'],
    communications: ['Administrator','Manager','Employee'],
    activities: ['Administrator','Manager','Employee'],
    reports: ['Administrator','Manager']
  };
  requireRole(user, mutationRoles[name]);
  const existingRows = new Map(db.prepare(`SELECT * FROM ${name}`).all().map(row => [row.id, row]));
  const validated = records.map(record => validateRecord(name, record, existingRows.get(Number(record.id))));
  const ids = new Set(validated.map(record => record.id));
  if (ids.size !== validated.length) throw Object.assign(new Error('Duplicate record IDs are not allowed.'), { status: 400 });
  if (name === 'users' && !validated.some(record => record.role === 'Administrator' && record.active)) {
    throw Object.assign(new Error('At least one active administrator is required.'), { status: 400 });
  }

  const deletedIds = [...existingRows.keys()].filter(id => !ids.has(id));
  if (name === 'partners') {
    const linkedDeal = db.prepare('SELECT deal_name FROM deals WHERE partner_id=? LIMIT 1');
    const linkedCommunication = db.prepare('SELECT subject FROM communications WHERE partner_id=? LIMIT 1');
    for (const id of deletedIds) {
      const partner = existingRows.get(id);
      const deal = linkedDeal.get(id);
      const communication = linkedCommunication.get(id);
      if (deal || communication) {
        const link = deal ? `deal "${deal.deal_name}"` : `communication "${communication.subject}"`;
        throw Object.assign(
          new Error(`Cannot delete partner "${partner.company_name}" because it is linked to ${link}. Remove or reassign the linked record first.`),
          { status: 409 }
        );
      }
    }
  }
  if (name === 'deals') {
    const linkedContract = db.prepare('SELECT contract_number FROM contracts WHERE deal_id=? LIMIT 1');
    for (const id of deletedIds) {
      const deal = existingRows.get(id);
      const contract = linkedContract.get(id);
      if (contract) {
        throw Object.assign(
          new Error(`Cannot delete deal "${deal.deal_name}" because contract "${contract.contract_number}" is linked to it. Remove or reassign the contract first.`),
          { status: 409 }
        );
      }
    }
  }

  transaction(() => {
    for (const record of validated) {
      const columns = Object.keys(record);
      const updateColumns = columns.filter(column => column !== 'id');
      const sql = `INSERT INTO ${name}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})
        ON CONFLICT(id) DO UPDATE SET ${updateColumns.map(column => `${column}=excluded.${column}`).join(',')}`;
      db.prepare(sql).run(...columns.map(column => record[column]));
    }
    for (const [id] of existingRows) {
      if (!ids.has(id)) {
        if (name === 'users' && id === user.id) throw Object.assign(new Error('You cannot delete your own account.'), { status: 400 });
        db.prepare(`DELETE FROM ${name} WHERE id=?`).run(id);
      }
    }
  });
  if (name === 'contracts') {
    const retained = new Set(validated.map(record => record.file_path).filter(Boolean));
    for (const row of existingRows.values()) {
      if (row.file_path && !retained.has(row.file_path)) {
        fs.rmSync(path.join(UPLOAD_DIR, row.file_path), { force: true });
      }
    }
  }
  return rows(name);
}

const loginAttempts = new Map();

async function api(req, res, url) {
  const user = currentUser(req);
  if (req.method !== 'GET') assertSameOrigin(req);

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const key = req.socket.remoteAddress || 'local';
    const attempts = (loginAttempts.get(key) || []).filter(time => Date.now() - time < 10 * 60 * 1000);
    if (attempts.length >= 10) return error(res, 429, 'Too many login attempts. Try again later.');
    const body = await readBody(req);
    const row = db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE AND active=1').get(validEmail(body.email));
    if (!row || !verifyPassword(String(body.password || ''), row.password_hash)) {
      attempts.push(Date.now());
      loginAttempts.set(key, attempts);
      return error(res, 401, 'Invalid email or password.');
    }
    loginAttempts.delete(key);
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionDays = body.remember ? 30 : SESSION_DAYS;
    const expires = new Date(Date.now() + sessionDays * 86400000);
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(new Date().toISOString());
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash, row.id, expires.toISOString());
    return json(res, 200, { user: publicUser(row) }, {
      'Set-Cookie': `manics_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDays * 86400}`
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = parseCookies(req).manics_session;
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));
    return json(res, 200, { ok: true }, {
      'Set-Cookie': 'manics_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/session') {
    return json(res, 200, { user });
  }

  if (!user) return error(res, 401, 'Authentication required.');

  if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
    const data = {};
    for (const name of Object.keys(tables)) {
      if (name === 'users' && !['Administrator','Manager'].includes(user.role)) data[name] = [];
      else data[name] = rows(name);
    }
    return json(res, 200, { user, data });
  }

  const collectionMatch = url.pathname.match(/^\/api\/collections\/([a-z]+)$/);
  if (req.method === 'PUT' && collectionMatch) {
    const body = await readBody(req);
    return json(res, 200, { data: syncCollection(collectionMatch[1], body.data, user) });
  }

  if (req.method === 'PUT' && url.pathname === '/api/profile') {
    const body = await readBody(req);
    const name = cleanText(body.fullname, 'Full name', { required: true, max: 100 });
    const email = validEmail(body.email);
    db.prepare('UPDATE users SET fullname=?,email=? WHERE id=?').run(name, email, user.id);
    return json(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)) });
  }

  if (req.method === 'PUT' && url.pathname === '/api/profile/password') {
    const body = await readBody(req);
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    if (!verifyPassword(String(body.current_password || ''), row.password_hash)) return error(res, 400, 'Current password is incorrect.');
    if (String(body.new_password || '').length < 8) return error(res, 400, 'New password must contain at least 8 characters.');
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(String(body.new_password)), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(user.id, crypto.createHash('sha256').update(parseCookies(req).manics_session).digest('hex'));
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/reset') {
    requireRole(user, ['Administrator']);
    db.exec('DELETE FROM sessions; DELETE FROM reports; DELETE FROM activities; DELETE FROM communications; DELETE FROM contracts; DELETE FROM deals; DELETE FROM partners; DELETE FROM users;');
    for (const entry of fs.readdirSync(UPLOAD_DIR)) {
      const target = path.join(UPLOAD_DIR, entry);
      if (fs.statSync(target).isFile()) fs.rmSync(target, { force: true });
    }
    seedDatabase();
    return json(res, 200, { ok: true }, {
      'Set-Cookie': 'manics_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    });
  }

  const fileMatch = url.pathname.match(/^\/api\/contracts\/(\d+)\/file$/);
  if (req.method === 'GET' && fileMatch) {
    const record = db.prepare('SELECT file_name,file_path,file_type FROM contracts WHERE id=?').get(Number(fileMatch[1]));
    if (!record?.file_path) return error(res, 404, 'No file is attached to this contract.');
    const fullPath = path.join(UPLOAD_DIR, record.file_path);
    if (!fs.existsSync(fullPath)) return error(res, 404, 'The stored file could not be found.');
    res.writeHead(200, {
      'Content-Type': record.file_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${String(record.file_name).replace(/["\r\n]/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff'
    });
    return fs.createReadStream(fullPath).pipe(res);
  }

  return error(res, 404, 'API endpoint not found.');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function staticFile(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const requested = path.resolve(ROOT, `.${pathname}`);
  if (!requested.startsWith(`${ROOT}${path.sep}`)) return error(res, 403, 'Forbidden.');
  fs.stat(requested, (statError, stat) => {
    if (statError || !stat.isFile()) return error(res, 404, 'Page not found.');
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(requested).toLowerCase()] || 'application/octet-stream',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    });
    fs.createReadStream(requested).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else staticFile(req, res, url);
  } catch (err) {
    const status = err.status || (String(err.message).includes('UNIQUE constraint') ? 409 : String(err.message).includes('FOREIGN KEY constraint') ? 409 : 500);
    if (status >= 500) console.error(err);
    const message = status === 500 ? 'An unexpected server error occurred.' :
      status === 409 && String(err.message).includes('constraint') ? 'This change conflicts with an existing or linked record.' : err.message;
    if (!res.headersSent) error(res, status, message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Manics Partnership System running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_FILE}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
