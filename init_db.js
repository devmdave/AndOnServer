require('dotenv').config();
const mongoose = require('mongoose');
const { User, Breakdown, Weldshop } = require('./models/Data');

async function initDb() {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 2. Models are already registered by the require above.
        //    syncIndexes() creates any missing indexes declared in the schema.
        await User.syncIndexes();
        console.log('✅ Indexes synced for: User');

        await Breakdown.syncIndexes();
        console.log('✅ Indexes synced for: Breakdown');

        await Weldshop.syncIndexes();
        console.log('✅ Indexes synced for: Weldshop');

        console.log('\n🎉 Database initialized successfully');
    } catch (err) {
        console.error('❌ Initialization failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

initDb();
