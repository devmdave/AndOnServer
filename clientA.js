/**
 * CLIENT A — Active test client
 * Triggers every event defined in server.js and logs all callbacks + broadcasts.
 *
 * Run: node clientA.js
 */

const { io } = require('socket.io-client');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const SERVER_URL = 'http://localhost:3000';

// Test data — adjust to match a real user in your DB for AUTH to succeed
const TEST_USER = 'admin';
const TEST_PASS = '1234';
const TEST_EQID = 'EQ-TEST-001';
const TEST_STATION = 'S1';
const TEST_MSTATION = 'M1';

const label = '[Client A]';
const log = (...args) => console.log(label, ...args);

// ─── CONNECT ───────────────────────────────────────────────────────────────────
const socket = io(SERVER_URL, { reconnection: false });

socket.on('connect', () => {
    log(`✅ Connected — socket id: ${socket.id}`);
    runTests();
});

socket.on('connect_error', (err) => {
    log(`❌ Connection error: ${err.message}`);
});

socket.on('disconnect', (reason) => {
    log(`🔌 Disconnected — reason: ${reason}`);
});

// ─── BROADCAST LISTENER ────────────────────────────────────────────────────────
// Client A also listens to weldshop_data broadcasts (sent by server after mutations)
socket.on('weldshop_data', (data) => {
    log('📡 Broadcast received — weldshop_data:', JSON.stringify(data, null, 2));
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── TEST SEQUENCE ────────────────────────────────────────────────────────────
async function runTests() {
    try {

        // ── 1. AUTH (valid credentials) ─────────────────────────────────────────────
        log('\n── Test 1: AUTH (valid) ──');
        log('  → Emitting AUTH', { username: TEST_USER, pass: TEST_PASS });
        socket.emit('AUTH', { username: TEST_USER, pass: TEST_PASS }, (res) => {
            log('  ← AUTH response:', res);
            // Expected: [true, fullName, role]
        });

        await delay(500);

        // ── 2. AUTH (invalid credentials) ───────────────────────────────────────────
        log('\n── Test 2: AUTH (invalid) ──');
        log('  → Emitting AUTH', { username: 'wrong', pass: 'wrong' });
        socket.emit('AUTH', { username: 'wrong', pass: 'wrong' }, (res) => {
            log('  ← AUTH response:', res);
            // Expected: [false, null, null]
        });

        await delay(500);

        // ── 3. SETBREAKDOWN ─────────────────────────────────────────────────────────
        log('\n── Test 3: SETBREAKDOWN ──');
        const bdPayload = { eqid: TEST_EQID, breakdown: 'Motor overheat' };
        log('  → Emitting SETBREAKDOWN', bdPayload);
        socket.emit('SETBREAKDOWN', bdPayload, (res) => {
            log('  ← SETBREAKDOWN response:', res);
            // Expected: true
        });

        await delay(500);

        // ── 4. GETBREAKDOWNS ────────────────────────────────────────────────────────
        log('\n── Test 4: GETBREAKDOWNS ──');
        const gbPayload = { eqid: TEST_EQID };
        log('  → Emitting GETBREAKDOWNS', gbPayload);
        socket.emit('GETBREAKDOWNS', gbPayload, (res) => {
            log('  ← GETBREAKDOWNS response:', res);
            // Expected: ['Motor overheat', ...]
        });

        await delay(500);

        // ── 5. GETDATA (before any alert) ───────────────────────────────────────────
        log('\n── Test 5: GETDATA (baseline) ──');
        log('  → Emitting GETDATA');
        socket.emit('GETDATA', {}, (res) => {
            log('  ← GETDATA response:', JSON.stringify(res, null, 2));
            // Expected: { ALERT: [...], ACK: [...] }
        });

        await delay(500);

        // ── 6. GETALERTSONLY (before any alert) ─────────────────────────────────────
        log('\n── Test 6: GETALERTSONLY (baseline) ──');
        log('  → Emitting GETALERTSONLY');
        socket.emit('GETALERTSONLY', {}, (res) => {
            log(`  ← GETALERTSONLY response: ${res.length} alert(s)`);
            if (res.length) log('    First alert:', JSON.stringify(res[0], null, 2));
        });

        await delay(500);

        // ── 7. SETALERT — triggers broadcast to all clients ──────────────────────────
        log('\n── Test 7: SETALERT ──');
        const alertPayload = {
            mstation: TEST_MSTATION,
            substation: TEST_STATION,
            equipment: 'Welder-X',
            eqid: TEST_EQID,
            user: TEST_USER,
            breakdown: 'Motor overheat',
        };
        log('  → Emitting SETALERT', alertPayload);
        socket.emit('SETALERT', alertPayload, (res) => {
            log('  ← SETALERT response:', res);
            // Expected: true  +  broadcast weldshop_data fires on all clients
        });

        await delay(800);

        // ── 8. SETALERT with missing fields (should return false) ────────────────────
        log('\n── Test 8: SETALERT (missing required fields) ──');
        log('  → Emitting SETALERT (no eqid)');
        socket.emit('SETALERT', { mstation: 'M1', substation: 'S1', equipment: 'Welder-X' }, (res) => {
            log('  ← SETALERT (bad payload) response:', res);
            // Expected: false
        });

        await delay(500);

        // ── 9. SETACK ────────────────────────────────────────────────────────────────
        log('\n── Test 9: SETACK ──');
        const ackPayload = { station: TEST_STATION, eqid: TEST_EQID, user: TEST_USER };
        log('  → Emitting SETACK', ackPayload);
        socket.emit('SETACK', ackPayload, (res) => {
            log('  ← SETACK response:', res);
            // Expected: true  +  broadcast weldshop_data fires
        });

        await delay(800);

        // ── 10. SETACK when no ALERT exists (should return false) ────────────────────
        log('\n── Test 10: SETACK (no matching ALERT) ──');
        log('  → Emitting SETACK again on same record (already ACK\'d)');
        socket.emit('SETACK', ackPayload, (res) => {
            log('  ← SETACK (no match) response:', res);
            // Expected: false (no ALERT state left)
        });

        await delay(500);

        // ── 11. SETOK ────────────────────────────────────────────────────────────────
        log('\n── Test 11: SETOK ──');
        const okPayload = { station: TEST_STATION, eqid: TEST_EQID, user: TEST_USER, ica: 'Replaced motor coupling' };
        log('  → Emitting SETOK', okPayload);
        socket.emit('SETOK', okPayload, (res) => {
            log('  ← SETOK response:', res);
            // Expected: true  +  broadcast weldshop_data fires
        });

        await delay(800);

        // ── 12. GETDATA (after full lifecycle) ───────────────────────────────────────
        log('\n── Test 12: GETDATA (after full lifecycle ALERT→ACK→OK) ──');
        socket.emit('GETDATA', {}, (res) => {
            log('  ← GETDATA response (record should be gone from ALERT/ACK):', JSON.stringify(res, null, 2));
        });

        await delay(500);

        // ── 13. SETOK with missing fields ────────────────────────────────────────────
        log('\n── Test 13: SETOK (missing required fields) ──');
        socket.emit('SETOK', { user: TEST_USER, ica: 'test' }, (res) => {
            log('  ← SETOK (bad payload) response:', res);
            // Expected: false
        });

        await delay(500);

        log('\n✅ [Client A] All tests dispatched. Waiting for any remaining callbacks…');

        await delay(2000);
        log('\n🏁 [Client A] Done. Disconnecting.');
        socket.disconnect();

    } catch (err) {
        log('❌ Unexpected error in test sequence:', err);
        socket.disconnect();
    }
}
