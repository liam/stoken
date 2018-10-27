import React, { Component } from "react";
import logo from "./logo.png";

import "./App.css";
let BITBOXSDK = require("bitbox-sdk/lib/bitbox-sdk").default;
let BITBOX = new BITBOXSDK({restURL: "https://trest.bitcoin.com/v1/"});

let langs = [
  "english",
  "chinese_simplified",
  "chinese_traditional",
  "korean",
  "japanese",
  "french",
  "italian",
  "spanish"
];

let lang = langs[Math.floor(Math.random() * langs.length)];

// create 256 bit BIP39 mnemonic
//let mnemonic = BITBOX.Mnemonic.generate(256, BITBOX.Mnemonic.wordLists()[lang]);
// use the same key always
let mnemonic ="échelle vétéran panorama quiétude météore fatal rubis ferveur gorge enfance matière surprise ronce temporel pochette bistouri monnaie oisillon loyal bitume sodium dénuder subtil accepter"


// root seed buffer
let rootSeed = BITBOX.Mnemonic.toSeed(mnemonic);

// master HDNode
let masterHDNode = BITBOX.HDNode.fromSeed(rootSeed, "testnet");

// HDNode of BIP44 account
let account = BITBOX.HDNode.derivePath(masterHDNode, "m/44'/145'/0'");

// derive the first external change address HDNode which is going to spend utxo
let change = BITBOX.HDNode.derivePath(account, "0/0");

// get the cash address
let cashAddress = BITBOX.HDNode.toCashAddress(change);

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mnemonic: mnemonic,
      lang: lang,
      hex: "",
      txid: ""
    };
  }

  componentDidMount() {
    BITBOX.Address.utxo(cashAddress).then(
      result => {
        if (!result[0]) {
          return;
        }
        // instance of transaction builder
        let transactionBuilder = new BITBOX.TransactionBuilder("testnet");
        // original amount of satoshis in vin
        // let originalAmount = result[0].satoshis;
        let originalAmount = 5000
        // index of vout
        let vout = result[0].vout;

        // txid of vout
        let txid = result[0].txid;

        // add input with txid and index of vout
        transactionBuilder.addInput(txid, vout);

        // get byte count to calculate fee. paying 1 sat/byte
        let byteCount = BITBOX.BitcoinCash.getByteCount(
          { P2PKH: 1 },
          { P2PKH: 3 }
        );
        // 192
        // amount to send to receiver. It's the original amount - 1 sat/byte for tx size
        let sendAmount = originalAmount - byteCount;

        // add output w/ address and amount to send
        transactionBuilder.addOutput(cashAddress, sendAmount);

        // keypair
        let keyPair = BITBOX.HDNode.toKeyPair(change);

        // sign w/ HDNode
        let buf = BITBOX.Script.nullData.output.encode(Buffer.from('test for beetles', 'ascii'));
  //

        transactionBuilder.addOutput(buff, 0);

        let redeemScript ;

        console.log('here!')
        
        transactionBuilder.sign(
          0,
          keyPair,
          redeemScript,
          transactionBuilder.hashTypes.SIGHASH_ALL,
          originalAmount
        );

        // build tx
        let tx = transactionBuilder.build();
        // output rawhex
        let hex = tx.toHex();
        this.setState({
          hex: hex
        });

        // sendRawTransaction to running BCH node
        BITBOX.RawTransactions.sendRawTransaction(hex).then(
          result => {
            this.setState({
              txid: result
            });
          },
          err => {
            console.log(err);
          }
        );
      },
      err => {
        console.log("error", err);
      }
    );
    console.log('end')
  }

  render() {
    let addresses = [];
    console.log('in render')
    for (let i = 0; i < 10; i++) {
      let account = masterHDNode.derivePath(`m/44'/145'/0'/0/${i}`);
      addresses.push(
        <li key={i}>
          m/44&rsquo;/145&rsquo;/0&rsquo;/0/
          {i}: {BITBOX.HDNode.toCashAddress(account)}
        </li>
      );
    }
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Hello BITBOX</h1>
        </header>
        <div className="App-content">
          <h2>BIP44 $BCH Wallet</h2>
          <h3>256 bit {lang} BIP39 Mnemonic:</h3> <p>{this.state.mnemonic}</p>
          <h3>BIP44 Account</h3>
          <p>
            <code>"m/44'/145'/0'"</code>
          </p>
          <h3>BIP44 external change addresses</h3>
          <ul>{addresses}</ul>
          <h3>Transaction raw hex</h3>
          <p>{this.state.hex}</p>
          <h3>Transaction ID</h3>
          <p>{this.state.txid}</p>
        </div>
      </div>
    );
  }
}

export default App;
