
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

// Transaction input decoder
const decoder = new InputDataDecoder("./src/microbuddiesABI.json");

// Connection with the database
const connection = mysql.createConnection({
    host: process.env.mysql_host,
    user: process.env.mysql_user,
    password: process.env.mysql_password,
    database: process.env.mysql_database
});
connection.connect();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// Async because we like to wait for processes
(async () => {
    async function doTheLoop() {
        // First transaction on the contract ever was in this block
        var block = 19762757;

        var waitForSelect = true;
        // Or if we already have a database
        connection.query("SELECT * FROM `transactions` ORDER BY `blockNumber` DESC LIMIT 1", function(error, results, fields) {
            if (typeof results[0] !== "undefined") {
                block = results[0].blockNumber;
            }
            waitForSelect = false;
        });
        while (waitForSelect) { await delay(1000); };
        while (true) {
            // Receive all transactions from `block` with a maximum of 10.000
            const response = await fetch('https://api-testnet.polygonscan.com/api?module=account&action=txlist&address=0xdcfddb06af6f1a8d4be001c43b0f3e29bfbd96db&startblock=' + block.toString() + '&endblock=99999999&sort=asc');
            const data = await response.json();

            try {
                // Try showing how many results we've gotten, if there was an error it won't be able to
                console.log("Gotten " + data.result.length.toString() + " transactions");
            } catch (err) {
                // If there is an error for debugging purposes: show the error, show the data gotten, close the database connection and stop the program
                console.log(err);
                console.log(data);
                connection.end();
                return;
            }

            // Create an empty list to put transactions in
            var transactions = [];

            // basically saying: create variable `i`, while `i` is smaller than the amount of results we have, keep on looping this and add +1 to `i`
            for (var i = 0; i < data.result.length; i++) {

                // Put the specific transaction from the results into a variable
                var transaction = data.result[i];

                // Decode the transaction data
                transaction.data = decoder.decodeData(transaction.input);

                // Gets parent microbuddy out of replication data
                var parentMicrobuddy = 0;
                if (transaction.data.method === "replicate" || transaction.data.method === "simpleReplicate") {
                    parentMicrobuddy = transaction.data.inputs[0].words[0];
                }

                // Create a new transaction object specifically containing the block number, timestamp when the transaction was, hash of the transaction, and the data
                transactions.push([
                    transaction.blockNumber,
                    transaction.timeStamp,
                    transaction.hash,
                    transaction.data.method,
                    JSON.stringify(transaction.data.types),
                    JSON.stringify(transaction.data.inputs),
                    JSON.stringify(transaction.data.names),
                    parentMicrobuddy
                ]);
            }

            // Put all the transactions into the database
            const query = connection.query('INSERT IGNORE INTO transactions (blockNumber, timestamp, hash, method, types, inputs, names, parentmicrobuddy) VALUES ?', [transactions], (error, results, fields) => {
                
                // if there is an error show what the transactions were and show the error (for debugging purposes)
                if (error) {
                    console.log(transactions);
                    throw error;
                }
            });

            // if the amount of transactions received was less than 10.000 (as the maximum to receive transactions is 10.000) it means we came to the end :D, stop the program
            if (transactions.length < 10000) {
                break;
            }

            // If the program didnt end before, we set the new `block` where it should find transactions from and loop again :D
            block = parseInt(transactions.at(-1)[0])+1;
        }
    }

    while(true) {
        await doTheLoop();
        console.log("Waiting 60 seconds before searching for new transactions");
        await delay(60000);
    }

    // Close the connection for good otherwise the program is going to pretend it's doing something which is annoying
    connection.end();
})();

