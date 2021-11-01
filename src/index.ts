
// "Yay" another project
// Just to annoy the fuck out of everyone reading this I'm going to comment on everything I do here.
// You know, just to add those extra bytes
// Go ahead, create a pull request to delete the comments

// Config import
import { config } from "dotenv";
config();

// HEheehe dependencies
import * as mysql from "mysql";
import fetch from "node-fetch";
const InputDataDecoder = require('ethereum-input-data-decoder');

const decoder = new InputDataDecoder("./src/microbuddiesABI.json");
const connection = mysql.createConnection({
    host: process.env.mysql_host,
    user: process.env.mysql_user,
    password: process.env.mysql_password,
    database: process.env.mysql_database
});
connection.connect();


// Async because we like to wait for processes
(async () => {
    var block = 19762757;
    while (true) {
        console.log(block);
        const response = await fetch('https://api-testnet.polygonscan.com/api?module=account&action=txlist&address=0xdcfddb06af6f1a8d4be001c43b0f3e29bfbd96db&startblock=' + block.toString() + '&endblock=99999999&sort=asc');
        const data = await response.json();
        try {
            console.log("Gotten " + data.result.length.toString() + " transactions");
        } catch (err) {
            console.log(err);
            console.log(data);
            connection.end();
            return;
        }
        var transactions = [];
        for (var i = 0; i < data.result.length; i++) {
            var transaction = data.result[i];
            transaction.data = decoder.decodeData(transaction.input);
            transactions.push([
                transaction.blockNumber,
                transaction.timeStamp,
                transaction.hash,
                transaction.data.method,
                JSON.stringify(transaction.data.types),
                JSON.stringify(transaction.data.inputs),
                JSON.stringify(transaction.data.names)
            ]);
        }
        const query = connection.query('INSERT IGNORE INTO transactions (blockNumber, timestamp, hash, method, types, inputs, names) VALUES ?', [transactions], (error, results, fields) => {
            if (error) {
                console.log(transactions);
                throw error;
            }
        });
        if (transactions.length < 10000) {
            break;
        }
        block = parseInt(transactions.at(-1)[0])+1;
    }
    connection.end();
})();

