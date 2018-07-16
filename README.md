# Overview

This is the gdax automated trading bot. Thoroughly read, understand, and update the code to fit how you want to trade. Trade at your own risk. I am not responsible for any losses resulting from use, or misuse, of this code.

# Getting Started

## Node Version
Install Node.js. Node.js v7.x or above is required. The setup is different for different systems. Check https://nodejs.org/en/ for installation instructions. Example install steps for linux:

## Clone the repository

## Install App Dependencies
Assuming the cloned files are at ~/, run the following in a terminal to install dependencies:
```
cd ~/gdax-trader
npm install
```

## Setup the configuration file
Copy ~/gdax-trader/config/config.js to ~/gdax-trader/lib/config.js

Fill in API data in the lib/config.js file made in the prior step. Find the exports.gdax object in this file. Follow the instructions in the comments above the object about filling in the properties.

Fill in the exports.currencies object with original holdings such as the amount of bitcoin currently held. These are the balances already in the accounts and the current prices. It is used to calculate gains or losses compared against a buy and hold strategy.

exports.currencies controls what currencies are used. USD is mandatory. The coins can be changed. For instance comment out 'LTC-USD': 'LTC', to stop trading with Litecoin, or add 'ETH-USD': 'ETH' to trade with Ethereum.

## Modify the Gdax Node Module
These changes must be made in the gdax npm node module located at ~/gdax-trader/node_modules/gdax/lib/clients/websocket.js
```
var WebsocketClient = function(productIDs, websocketURI, auth, channel) { // added channel parameter line 13
```
and
```
self.channel = channel; // added channel setting line 16
```
and
```
if (self.channel) { // added channel logic line 65
  subscribeMessage.channels = [{ "name": self.channel, "product_ids": self.productIDs }]
} else {
  self.product_ids = self.productIDs;
}
```
and
```
var sig = signRequest(self.auth, 'GET', '/users/self/verify'); // changed url for auth line 73
```

## Run the program
start index.js
```
cd ~/gdax-trader
node index.js
```
