import React, { Component } from "react";
import logo from "./ref_trust.jpeg";
import Slider from 'react-rangeslider'
import {Badge , Panel , FormGroup, Checkbox , FormControl ,ControlLabel} from 'react-bootstrap'


import "./App.css";
import 'react-rangeslider/lib/index.css'

const BITBOXSDK = require("bitbox-sdk/lib/bitbox-sdk").default;
const BITBOX = new BITBOXSDK({restURL: "https://trest.bitcoin.com/v1/"});

const langs = [
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

const AppScriptPrefix = 'RT1'

const messageTypes = {
  define: 'def',
  request: 'req',
  reply: 'rep'
}

const availableReviewTypes = {
  personal: 'per',
  corporate: 'corp',
  product: 'prod'
}

const availableQuestions = {
  p1: 'Works Well With Others', 
  p2: 'Communication Skills',
  p3: 'Leadership Skills'
}

// create 256 bit BIP39 mnemonic
//let mnemonic = BITBOX.Mnemonic.generate(256, BITBOX.Mnemonic.wordLists()[lang]);
// use the same key always
const mnemonic ="échelle vétéran panorama quiétude météore fatal rubis ferveur gorge enfance matière surprise ronce temporel pochette bistouri monnaie oisillon loyal bitume sodium dénuder subtil accepter"

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
      txid: "",
      commSkills: 0,
      workWithOther:0,
      address1:'bchtest:qpfvuahs9hksp4xvy85pdlvcvr98tjww7sp3gz38dd', // Feedback 1 provider address 
      address2:'bchtest:qq7n8p6vxlauu3mnd67watyzmk5v46qgp5s4gv96et', // Feedback 1 provider address 
      askCommSkills: false,
      askWorkWithOther: false,
      requestQuestionsList: [],   // p1,p2
      receivedQuestionsList: ['p1','p2'],  // p1,p2
      receivedAnswersList: [],    // p1:4,p2:8
      answerList:[],
      addressForFeedback: 'bchtest:qpfvuahs9hksp4xvy85pdlvcvr98tjww7sp3gz38dd', // Address of feedback provider 1 to fetch request 
      requesterAddress: 'bchtest:qqpmqdsqxrxd33qf56q6du28fxtv2e962utrge2f0h'
    };
  }  
  
  encodeScript(formType, messageType, text) {
    // AppScriptPrefix, messageType, reviewTypes, questionKeys

    let ss = AppScriptPrefix.concat(',', [formType, messageType, text])
    console.log('script text:', ss)
    return BITBOX.Script.nullData.output.encode(Buffer.from(ss, 'ascii'))
  }

  decodeScript(hex) {
    return BITBOX.Script.nullData.output.decode(Buffer.from(hex, 'hex')).toString('ascii');
  }

  sendRatingsRequests() {
    /*
      Example of OP_RETURN
      'RT1,req,rp1,p1,p2,p3'
      AppScriptPrefix, messageType, reviewTypes, questionKeys
    */
    const addresses = ['bchtest:qpfvuahs9hksp4xvy85pdlvcvr98tjww7sp3gz38dd', 'bchtest:qq7n8p6vxlauu3mnd67watyzmk5v46qgp5s4gv96et']
    let questions = this.state.requestQuestionsList.join(',')
    console.log('sendRatingsRequests:requestQuestionsList', questions)
    
    const reviewCost = 100

    BITBOX.Address.utxo(cashAddress).then(
      result => {
        if (!result[0]) {
          return;
        }
        // instance of transaction builder
        let transactionBuilder = new BITBOX.TransactionBuilder("testnet");
        // original amount of satoshis in vin
        let originalAmount = result[0].satoshis;
        // index of vout
        let vout = result[0].vout;
        // txid of vout
        let txid = result[0].txid;
        // add input with txid and index of vout
        transactionBuilder.addInput(txid, vout);
        
        // get byte count to calculate fee. paying 1 sat/byte
        let byteCount = BITBOX.BitcoinCash.getByteCount(
          { P2PKH: 1 },
          { P2PKH: 5 }
        );
        // amount to send to receiver. It's the original amount - 1 sat/byte for tx size
        let sendAmount = originalAmount - byteCount;

        sendAmount -= (reviewCost * addresses.length)
        // add output w/ address and amount to send
        transactionBuilder.addOutput(cashAddress, sendAmount);

        addresses.forEach(address => {
          transactionBuilder.addOutput(address, reviewCost)          
        });

        // keypair
        let keyPair = BITBOX.HDNode.toKeyPair(change);

        // 
        let buf = this.encodeScript(availableReviewTypes.personal, messageTypes.request, questions);

        transactionBuilder.addOutput(buf, 0);

        let redeemScript ;
        
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
        // TODO: comment out to send
       // return false;
        // sendRawTransaction to running BCH node
        console.log('sendRatingsRequests:hex ', hex)
        BITBOX.RawTransactions.sendRawTransaction(hex).then(
          result => {
            console.log('successfully send transaction:', result)
            this.setState({
              txid: result
            });
          },
          err => {
            console.log('error sending transaction:', err);
          }
        );
      },
      err => {
        console.log("error", err);
      }
    );
  }

  getScriptFromTransaction(transactionId) {      
    BITBOX.Transaction.details([transactionId]).then(
      result => {
        if (result.length === 0) {
          return
        }
        result[0].vout.forEach(o => {
          if (!o.scriptPubKey.addresses){
            console.log('getScriptFromTransaction:script = ', o.scriptPubKey.hex)
            let decodedScript = this.decodeScript(o.scriptPubKey.hex)
            let tmpArr = decodedScript.split(',')
            // AppScriptPrefix, messageType, reviewTypes, questionKeys
            if (tmpArr[1] === messageTypes.request) {
              this.state.receivedQuestionsList = tmpArr.slice(3, tmpArr.length + 1) // ['p1','p3']
            } else if (tmpArr[1] === messageTypes.reply) {
              this.state.receivedAnswersList = tmpArr.slice(3, tmpArr.length + 1) //['p1:5', 'p3:8']
            }
            
            console.log('getScriptFromTransaction:decoded = ', decodedScript)

            this.setState({
              receivedScript: decodedScript
            });
          return o.scriptPubKey.hex
          }
        })
      },
      err => {
      console.log('error getting script', err)
      }
    )
  }
   

  getRatingsRequest(address) {
    // let address = 'bchtest:qpfvuahs9hksp4xvy85pdlvcvr98tjww7sp3gz38dd'
    BITBOX.Address.utxo(address).then(
      async result => {
        if (!result[0]) {
          return;
        }
        console.log('getRatingsRequest:txid: ', result[0].txid)
        this.getScriptFromTransaction(result[0].txid)
      },
      err => {
        console.log("error", err);
      }
    );
  }

  sendRatingsReply() {
    BITBOX.Address.utxo(this.state.requesterAddress).then(
      result => {
        if (!result[0]) {
          return;
        }
        // instance of transaction builder
        let transactionBuilder = new BITBOX.TransactionBuilder("testnet");
        // original amount of satoshis in vin
        let originalAmount = result[0].satoshis;
        // index of vout
        let vout = result[0].vout;
        // txid of vout
        let txid = result[0].txid;
        // add input with txid and index of vout
        transactionBuilder.addInput(txid, vout);
        
        // let requesterAddress = "bchtest:qqpmqdsqxrxd33qf56q6du28fxtv2e962utrge2f0h"
        // get byte count to calculate fee. paying 1 sat/byte
        let byteCount = BITBOX.BitcoinCash.getByteCount(
          { P2PKH: 1 },
          { P2PKH: 5 }
          );
        // 192
        // amount to send to receiver. It's the original amount - 1 sat/byte for tx size
        let sendAmount = originalAmount - byteCount;

        // add output w/ address and amount to send
        transactionBuilder.addOutput(this.state.requesterAddress, sendAmount)
        // keypair
        let keyPair = BITBOX.HDNode.toKeyPair(change);

        // sign w/ HDNode
        let buf = this.encodeScript(availableReviewTypes.personal, messageTypes.reply, this.state.answerList.join(','));
        transactionBuilder.addOutput(buf, 0);

        let redeemScript ;
        
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

        // TODO: comment out to send
        //return false;
        // sendRawTransaction to running BCH node
        BITBOX.RawTransactions.sendRawTransaction(hex).then(
          result => {
            console.log('successfully send transaction:', result)
            this.setState({
              txid: result
            });
          },
          err => {
            console.log('error sending transaction:', err);
          }
        );
      },
      err => {
        console.log("error", err);
      }
    );
  }

  handleOnChangeSlider1 = (value) => {
    this.setState({
      workWithOther: value
    })
  }

  handleOnChangeSlider2 = (value) => {
    this.setState({
      commSkills: value
    })
  }

  sendRequest = () => {
    this.state.requestQuestionsList= []
  
  
  if(this.state.askCommSkills)
  {
    this.state.requestQuestionsList.push('p2')
  }
  
  if(this.state.askWorkWithOther)
  {
    this.state.requestQuestionsList.push('p1')
  }
  this.sendRatingsRequests()
  }

  handleOnChangeAddress1 = (e) => {
    this.setState({
      address1: e.target.value
    })
  }
      
  handleOnChangeAddress2 = (e) => {
    this.setState({
      address2: e.target.value
    })
  }

  handleOnChangeAsk1 = (e) => {
    this.setState({
      askWorkWithOther: e.target.checked
    })
  }
        
    handleOnChangeAsk2 = (e) => {
      this.setState({
        askCommSkills: e.target.checked
      })
    }

    sendFeedback = () => {
    this.state.answerList= [];
    
    if(this.state.commSkills)
    {
      this.state.answerList.push('p2:'+ this.state.commSkills)
    }
    
    if(this.state.workWithOther)
    {
      this.state.answerList.push('p1:'+ this.state.workWithOther)
    }
    this.sendRatingsReply()
  }


   fetchFeedback = () => {
      this.getRatingsRequest(this.state.addressForFeedback)
   }

handleOnChangeAddressForFeedback = (e) => {
      this.setState({
          addressForFeedback: e.target.value
      })
    }


  render() {
    let addresses = [];
    let { commSkills, workWithOther} = this.state
    
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Ref Trust</h1>
          <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" ></link>
          <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap-theme.min.css" ></link>
        </header>
        <div className="App-content">
        <br/>
        <br/>

        {/* ************************* Request  Feedback ************************* */}
        <Panel bsStyle="info">
          <Panel.Heading>
            <Panel.Title componentClass="h2">Create a feedback request</Panel.Title>
          </Panel.Heading>
          <Panel.Body >
          
          <FormGroup controlId="formControlsSelect">
            <ControlLabel>Select feedback type</ControlLabel>
              <FormControl componentClass="select" placeholder="personal">
                {/* <option value="select">select</option> */}
                <option value="personal">Personal Feedback</option>
                <option value="product">Product Feedback</option>
                <option value="corporate">Corporate Feedback</option>
              </FormControl>
          </FormGroup>
                        <br/>
                        <br/>

            <h4>Select questions</h4>

            <FormGroup>
              <Checkbox inline onChange={this.handleOnChangeAsk1}>Works Well With Others</Checkbox> 
              <Checkbox inline onChange={this.handleOnChangeAsk2}>Communication Skills</Checkbox>
              <Checkbox inline >Leadership Skills</Checkbox>

              <br/>
              <br/>
              <br/>
            </FormGroup>
            <h4>Request Feedback from address 1 </h4>
              <FormControl
              type="text"
              value={this.state.address1}
              placeholder="Enter address 1"
              onChange={this.handleOnChangeAddress1}
            />
           <br/>
            <h4>Request Feedback from address 2 </h4>
            <FormControl
              label="Text"
              type="text"
              value={this.state.address2}
              placeholder="Enter address 2"
              onChange={this.handleOnChangeAddress2}
            />
            <br/>
            <br/>
            <button className="btn btn-primary" onClick={this.sendRequest}>
             Send Request
            </button>
          </Panel.Body>
        </Panel>
        <br/><br/><br/><br/><br/><br/>
        {/* ************************* Provide  Feedback ************************* */}

        <Panel bsStyle="success">
          <Panel.Heading>
            <Panel.Title componentClass="h3">Provide feedback</Panel.Title>
          </Panel.Heading>
            <Panel.Body>Panel content
            <h2>Provide feedback </h2>

              <h4>Address</h4>
              <FormControl
              type="text"
              value={this.state.addressForFeedback}
              placeholder="Check request"
              onChange={this.handleOnChangeAddressForFeedback}
            />
            <br/>
            <button className="btn btn-primary" onClick={this.fetchFeedback}>
             Fetch Request
            </button>
            <br/>
            <br/>
            {  
             
              this.state.receivedQuestionsList.map(function(item, index) {
            if(item === 'p1'){
            return <div key={index}>
            <h3>Works Well With Others</h3> 
            <Slider  value={workWithOther} orientation="horizontal" labels={{ 0:'Low', 5:'Medium', 10:"High"}} tooltip={true} min={0} max={10} step={1} onChange={this.handleOnChangeSlider1}/> 
              <br/>
              <br/>
              <br/>

              </div>
            }
            
            if(item.toString() === 'p2'){
           return <div key={index}>
             <h3>Communication Skills</h3> 
             <Slider   value={commSkills} orientation="horizontal" labels={{ 0:'Low', 5:'Medium', 10:"High"}} tooltip={true} min={0} 
              max={10} step={1} onChange={this.handleOnChangeSlider2}/> 
              </div>
              }
            }, this) 
            
            }
            <br/>
            <br/> 
            <button className="btn btn-primary" onClick={this.sendFeedback}>
              Send Feedback
             </button>
          </Panel.Body>
        </Panel>
         <br/><br/><br/><br/><br/><br/>
        
        {/* ************************* View  Feedback ************************* */}
        <Panel bsStyle="primary">
          <Panel.Heading>
            <Panel.Title componentClass="h3">View feedback</Panel.Title>
          </Panel.Heading>
          <Panel.Body>
          <h2>Recieved on 28/10/2018 12:33</h2>
          <h3>
          Works Well With Others   <Badge>{9}</Badge>
          </h3>
          <h3>
          Communication Skills     <Badge>{5}</Badge>
          </h3>
          <br/>
          <h2>Recieved on 28/10/2018 12:28</h2>
          <h3>
          Works Well With Others   <Badge>{this.state.workWithOther}</Badge>
          </h3>
          <h3>
          Communication Skills     <Badge>{this.state.commSkills}</Badge>
          </h3>
          </Panel.Body>
        </Panel>
         <br/><br/><br/><br/><br/><br/>

        </div>
      </div>
    );
  }
}

export default App;
