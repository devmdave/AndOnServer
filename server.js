require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const { User, Breakdown, Weldshop } = require('./models/Data');

// ─── APP SETUP ────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// Simple health-check endpoint
app.get('/', (req, res) => res.send('AndOn Server is running.'));

// ─── MONGODB CONNECTION ───────────────────────────────────────────────────────
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
    });

// ─── HELPER: broadcast current ALERT/ACK data to all clients ─────────────────
async function broadcastWeldshopData() {
    try {
        const all = await Weldshop.find({ state: { $in: ['ALERT', 'ACK'] } }).lean();

        const alerts = all
            .filter((r) => r.state === 'ALERT')
            .map((r) => [r.mstation, r.station, r.eqid]);

        const acks = all
            .filter((r) => r.state === 'ACK')
            .map((r) => [r.mstation, r.station, r.eqid]);

        io.emit('weldshop_data', { ALERT: alerts, ACK: acks });
    } catch (err) {
        console.error('broadcastWeldshopData error:', err);
    }
}

// ─── SOCKET.IO EVENTS ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ── AUTH ────────────────────────────────────────────────────────────────────
    // Emit: { username, pass }
    // Callback: [true, fullName, role]  or  [false, null, null]
    socket.on('AUTH', async (data, callback) => {
        try {
            const user = await User.findOne({
                username: data.username?.toString(),
                password: data.pass?.toString(),
            }).lean();

            if (user) {
                callback([true, user.fullName, user.role]);
            } else {
                callback([false, null, null]);
            }
        } catch (err) {
            console.error('AUTH error:', err);
            callback([false, null, null]);
        }
    });

    // ── SETBREAKDOWN ─────────────────────────────────────────────────────────────
    // Emit: { eqid, breakdown }
    // Callback: true | false
    socket.on('SETBREAKDOWN', async (data, callback) => {
        try {
            await Breakdown.create({ eqid: data.eqid, breakdown: data.breakdown });
            callback(true);
        } catch (err) {
            console.error('SETBREAKDOWN error:', err);
            callback(false);
        }
    });

    // ── GETBREAKDOWNS ────────────────────────────────────────────────────────────
    // Emit: { eqid }
    // Callback: [ breakdown, ... ]
    socket.on('GETBREAKDOWNS', async (data, callback) => {
        try {
            const records = await Breakdown.find({ eqid: data.eqid }).lean();
            callback(records.map((r) => r.breakdown));
        } catch (err) {
            console.error('GETBREAKDOWNS error:', err);
            callback([]);
        }
    });

    // ── GETDATA ──────────────────────────────────────────────────────────────────
    // Returns { ALERT: [[mstation,station,eqid],...], ACK: [[mstation,station,eqid],...] }
    // Callback: the object above
    socket.on('GETDATA', async (data, callback) => {
        try {
            const all = await Weldshop.find({ state: { $in: ['ALERT', 'ACK'] } }).lean();

            const alerts = all
                .filter((r) => r.state === 'ALERT')
                .map((r) => [r.mstation, r.station, r.eqid]);

            const acks = all
                .filter((r) => r.state === 'ACK')
                .map((r) => [r.mstation, r.station, r.eqid]);

            callback({ ALERT: alerts, ACK: acks });
        } catch (err) {
            console.error('GETDATA error:', err);
            callback(null);
        }
    });

    // ── GETALERTSONLY ────────────────────────────────────────────────────────────
    // Callback: full Weldshop documents with state === 'ALERT'
    socket.on('GETALERTSONLY', async (data, callback) => {
        try {
            const records = await Weldshop.find({ state: 'ALERT' }).lean();
            callback(records);
        } catch (err) {
            console.error('GETALERTSONLY error:', err);
            callback([]);
        }
    });

    // ── SETALERT ─────────────────────────────────────────────────────────────────
    // Emit: { mstation, substation, equipment, eqid, user, breakdown }
    // Saves a new ALERT row and broadcasts updated data to ALL clients
    socket.on('SETALERT', async (data, callback) => {
        if (!data.substation || !data.equipment || !data.eqid) {
            if (callback) callback(false);
            return;
        }

        try {
            const now = new Date();
            await Weldshop.create({
                mstation: data.mstation?.toString() ?? '',
                station: data.substation.toString(),
                equip: data.equipment.toString(),
                state: 'ALERT',
                eqid: data.eqid.toString(),
                user: data.user ?? '',
                alertDate: now.toLocaleDateString(),
                alertTime: now.toLocaleTimeString(),
                breakdown: data.breakdown ?? '',
            });

            await broadcastWeldshopData();
            if (callback) callback(true);
        } catch (err) {
            console.error('SETALERT error:', err);
            if (callback) callback(false);
        }
    });

    // ── SETACK ───────────────────────────────────────────────────────────────────
    // Emit: { station, eqid, user }
    // Finds the first matching ALERT record, updates its state to ACK
    socket.on('SETACK', async (data, callback) => {
        if (!data.station || !data.eqid) {
            if (callback) callback(false);
            return;
        }

        try {
            const now = new Date();
            const record = await Weldshop.findOneAndUpdate(
                { station: data.station.toString(), eqid: data.eqid.toString(), state: 'ALERT' },
                {
                    state: 'ACK',
                    ackUser: data.user ?? '',
                    ackDate: now.toLocaleDateString(),
                    ackTime: now.toLocaleTimeString(),
                },
                { new: true }
            );

            if (!record) {
                if (callback) callback(false);
                return;
            }

            await broadcastWeldshopData();
            if (callback) callback(true);
        } catch (err) {
            console.error('SETACK error:', err);
            if (callback) callback(false);
        }
    });

    // ── SETOK ────────────────────────────────────────────────────────────────────
    // Emit: { station, eqid, user, ica }
    // Finds the first matching ACK record, updates its state to OK
    socket.on('SETOK', async (data, callback) => {
        if (!data.station || !data.eqid) {
            if (callback) callback(false);
            return;
        }

        try {
            const now = new Date();
            const record = await Weldshop.findOneAndUpdate(
                { station: data.station.toString(), eqid: data.eqid.toString(), state: 'ACK' },
                {
                    state: 'OK',
                    ica: data.ica ?? '',
                    okUser: data.user ?? '',
                    okDate: now.toLocaleDateString(),
                    okTime: now.toLocaleTimeString(),
                },
                { new: true }
            );

            if (!record) {
                if (callback) callback(false);
                return;
            }

            await broadcastWeldshopData();
            if (callback) callback(true);
        } catch (err) {
            console.error('SETOK error:', err);
            if (callback) callback(false);
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
