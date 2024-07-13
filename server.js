const express = require('express');
const { Web3 } = require('web3');
const bodyParser = require('body-parser');
const cors = require('cors');
const Redis = require('ioredis');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000; // Use PORT from environment variables if available, otherwise default to 3000

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Redis setup for IP tracking
const redis = new Redis(); // Assumes a local Redis instance. Adjust as needed.

// Web3 setup
const web3 = new Web3(process.env.ETHEREUM_NODE_URL); // Loaded from .env file

// Load contract ABI
const contractABIPath = path.join(__dirname, 'contractABI.json');
const contractABI = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));

const contractAddress = process.env.CONTRACT_ADDRESS; // Loaded from .env file
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Owner's account (Be extremely careful with private keys!)
const ownerPrivateKey = process.env.PRIVATE_KEY; // Loaded from .env file
const ownerAccount = web3.eth.accounts.privateKeyToAccount(ownerPrivateKey);
web3.eth.accounts.wallet.add(ownerAccount);

// IP validation endpoint
app.post('/validate-ip', async (req, res) => {
    const { ip } = req.body;
    
    try {
        const lastWithdrawal = await redis.get(`lastWithdrawal:${ip}`);
        const now = Date.now();
        
        if (lastWithdrawal && now - parseInt(lastWithdrawal) < 24 * 60 * 60 * 1000) {
            // Less than 24 hours since last withdrawal
            res.json({ allowed: false });
        } else {
            // Allow withdrawal and update timestamp
            await redis.set(`lastWithdrawal:${ip}`, now);
            res.json({ allowed: true });
        }
    } catch (error) {
        console.error('Error validating IP:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Withdrawal endpoint
app.post('/withdraw', async (req, res) => {
    const { address } = req.body;
    
    try {
        const gasPrice = await web3.eth.getGasPrice();
        const gasEstimate = await contract.methods.withdrawTo(address).estimateGas({ from: ownerAccount.address });
        
        const tx = await contract.methods.withdrawTo(address).send({
            from: ownerAccount.address,
            gas: gasEstimate,
            gasPrice: gasPrice
        });
        
        res.json({ success: true, transactionHash: tx.transactionHash });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ error: 'Withdrawal failed' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

//REAL CONTRACT 0xd716E70f80723B3Bc667806c50A469c3997A9Dc5
