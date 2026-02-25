const mongoose = require('mongoose');

// ─── USERS ────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    fullName: { type: String, default: '' },
    role: { type: String, default: '' },
});

// ─── EQUIPMENT BREAKDOWNS (EQ_BD sheet) ───────────────────────────────────────
const breakdownSchema = new mongoose.Schema({
    eqid: { type: String, required: true },
    breakdown: { type: String, required: true },
}, { timestamps: true });

// ─── WELDSHOP ALERTS ──────────────────────────────────────────────────────────
// Column map from original sheet:
//  A=mstation  B=station  C=equip  D=state  E=eqid  F=user
//  G=alertDate H=alertTime  I=breakdown
//  J=ica (set on OK)
//  K=ackUser  L=ackDate  M=ackTime
//  N=okUser   O=okDate   P=okTime
const weldshopSchema = new mongoose.Schema({
    mstation: { type: String, default: '' },
    station: { type: String, required: true },
    equip: { type: String, default: '' },
    state: { type: String, enum: ['ALERT', 'ACK', 'OK'], default: 'ALERT' },
    eqid: { type: String, required: true },

    // Alert metadata
    user: { type: String, default: '' },
    alertDate: { type: String, default: '' },
    alertTime: { type: String, default: '' },
    breakdown: { type: String, default: '' },

    // ICA (Immediate Corrective Action) — set when state transitions to OK
    ica: { type: String, default: '' },

    // ACK metadata
    ackUser: { type: String, default: '' },
    ackDate: { type: String, default: '' },
    ackTime: { type: String, default: '' },

    // OK metadata
    okUser: { type: String, default: '' },
    okDate: { type: String, default: '' },
    okTime: { type: String, default: '' },
}, { timestamps: true });

// Descending index on createdAt for fast time-based queries
breakdownSchema.index({ createdAt: -1 });
weldshopSchema.index({ createdAt: -1 });
weldshopSchema.index({ state: 1, eqid: 1 }); // common query pattern

const User = mongoose.model('User', userSchema);
const Breakdown = mongoose.model('Breakdown', breakdownSchema);
const Weldshop = mongoose.model('Weldshop', weldshopSchema);

module.exports = { User, Breakdown, Weldshop };
