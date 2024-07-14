

const express = require('express');
const Web3 = require('web3');
const bodyParser = require('body-parser');
const cors = require('cors');
const Redis = require('ioredis');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

let redis;

// Check for required environment variables
const requiredEnvVars = ['ETHEREUM_NODE_URL', 'CONTRACT_ADDRESS', 'PRIVATE_KEY', 'REDIS_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: ${envVar} is not set in the environment variables.`);
        process.exit(1);
    }
}

// Redis setup
if (process.env.NODE_ENV === 'production') {
    redis = new Redis(process.env.REDIS_URL);
} else {
    redis = new Redis();
}

redis.on('error', (error) => {
    console.error('Redis connection error:', error);
});

// Web3 setup
const web3 = new Web3(process.env.ETHEREUM_NODE_URL);

const contractABIPath = path.join(__dirname, 'contractABI.json');
const contractABI = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));

const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);

const ownerPrivateKey = process.env.PRIVATE_KEY;
const ownerAccount = web3.eth.accounts.privateKeyToAccount(ownerPrivateKey);
web3.eth.accounts.wallet.add(ownerAccount);

// IP validation endpoint
app.post('/validate-ip', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Received IP validation request from:', ip);
    
    try {
        const lastWithdrawal = await redis.get(`lastWithdrawal:${ip}`);
        const now = Date.now();
        
        if (lastWithdrawal && now - parseInt(lastWithdrawal) < 24 * 60 * 60 * 1000) {
            console.log(`IP ${ip} not allowed: recent withdrawal`);
            res.json({ allowed: false });
        } else {
            await redis.set(`lastWithdrawal:${ip}`, now);
            console.log(`IP ${ip} allowed for withdrawal`);
            res.json({ allowed: true });
        }
    } catch (error) {
        console.error('Error validating IP:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Withdrawal endpoint
app.post('/withdraw', async (req, res) => {
    const { address } = req.body;
    console.log('Received withdrawal request for address:', address);
    
    try {
        const gasPrice = await web3.eth.getGasPrice();
        const gasEstimate = await contract.methods.withdrawTo(address).estimateGas({ from: ownerAccount.address });
        
        const tx = await contract.methods.withdrawTo(address).send({
            from: ownerAccount.address,
            gas: gasEstimate,
            gasPrice: gasPrice
        });
        
        console.log('Withdrawal successful. Transaction hash:', tx.transactionHash);
        res.json({ success: true, transactionHash: tx.transactionHash });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ error: 'Withdrawal failed', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
