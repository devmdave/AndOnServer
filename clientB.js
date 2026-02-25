/**
 * CLIENT B — Passive listener / broadcast validator
 * Connects to the server, listens to ALL broadcasts, and validates
 * that events triggered by Client A arrive correctly.
 * Also runs a minimal request-response test (AUTH + GETDATA).
 *
 * Run: node clientB.js   (keep running while you run clientA.js)
 */

const { io } = require('socket.io-client');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://localhost:3000';

const label = '[Client B]';
const log = (...args) => console.log(label, ...args);

// ─── CONNECT ───────────────────────────────────────────────────────────────────
const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 2000,
});

socket.on('connect', () => {
    log(`✅ Connected — socket id: ${socket.id}`);
    runOwnTests();
});

socket.on('connect_error', (err) => {
    log(`❌ Connection error: ${err.message}`);
});

socket.on('reconnect', (attempt) => {
    log(`🔄 Reconnected after ${attempt} attempt(s)`);
});

socket.on('disconnect', (reason) => {
    log(`🔌 Disconnected — reason: ${reason}`);
});

// ─── BROADCAST LISTENERS ───────────────────────────────────────────────────────
// This is the primary realtime broadcast the server emits after SETALERT / SETACK / SETOK
socket.on('weldshop_data', (data) => {
    log('📡 Broadcast received — weldshop_data:');
    log('   ALERT entries:', data.ALERT?.length ?? 0);
    if (data.ALERT?.length) {
        data.ALERT.forEach((entry, i) => {
            log(`     [${i}] mstation="${entry[0]}"  station="${entry[1]}"  eqid="${entry[2]}"`);
        });
    }
    log('   ACK entries:', data.ACK?.length ?? 0);
    if (data.ACK?.length) {
        data.ACK.forEach((entry, i) => {
            log(`     [${i}] mstation="${entry[0]}"  station="${entry[1]}"  eqid="${entry[2]}"`);
        });
    }

    // ── Validate broadcast structure ──────────────────────────────────────────────
    const valid =
        data !== null &&
        typeof data === 'object' &&
        Array.isArray(data.ALERT) &&
        Array.isArray(data.ACK);

    log(valid
        ? '  ✅ Broadcast structure is valid'
        : '  ❌ Broadcast structure is INVALID — expected { ALERT: [], ACK: [] }');
});

// ─── CLIENT B'S OWN REQUEST-RESPONSE TESTS ────────────────────────────────────
async function runOwnTests() {
    // Small delay so Client B registers before Client A starts firing
    await delay(300);

    log('\n── Client B Test 1: AUTH (should succeed with valid creds) ──');
    socket.emit('AUTH', { username: 'admin', pass: '1234' }, (res) => {
        log('  ← AUTH response:', res);
        const ok = Array.isArray(res) && res[0] === true;
        log(ok ? '  ✅ AUTH passed' : '  ❌ AUTH failed — check user exists in DB');
    });

    await delay(500);

    log('\n── Client B Test 2: GETDATA (fetch current alert/ack state) ──');
    socket.emit('GETDATA', {}, (res) => {
        if (!res) {
            log('  ← GETDATA response: null (server error or no data)');
            return;
        }
        log(`  ← GETDATA response: ${res.ALERT.length} ALERT(s), ${res.ACK.length} ACK(s)`);
        const ok = typeof res === 'object' && Array.isArray(res.ALERT) && Array.isArray(res.ACK);
        log(ok ? '  ✅ GETDATA structure valid' : '  ❌ GETDATA structure INVALID');
    });

    await delay(500);

    log('\n── Client B Test 3: GETBREAKDOWNS (verify stored breakdowns) ──');
    socket.emit('GETBREAKDOWNS', { eqid: 'EQ-TEST-001' }, (res) => {
        log('  ← GETBREAKDOWNS response:', res);
        log(Array.isArray(res)
            ? `  ✅ GETBREAKDOWNS returned array with ${res.length} item(s)`
            : '  ❌ GETBREAKDOWNS returned unexpected type');
    });

    await delay(500);

    log('\n── Client B Test 4: GETALERTSONLY ──');
    socket.emit('GETALERTSONLY', {}, (res) => {
        log(`  ← GETALERTSONLY response: ${res.length} alert(s)`);
        log(Array.isArray(res)
            ? '  ✅ GETALERTSONLY returned array'
            : '  ❌ GETALERTSONLY returned unexpected type');
    });

    log('\n📡 [Client B] Passive listeners active — waiting for broadcasts from Client A…');
    log('   (Run "node clientA.js" in another terminal to trigger all events)\n');
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Keep process alive
process.on('SIGINT', () => {
    log('\n👋 Shutting down on SIGINT…');
    socket.disconnect();
    process.exit(0);
});
