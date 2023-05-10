var app 	= require("./lib/application");
var http  	= require("http");
var https  	= require("https");
var util 	= require("util");
var _ 		= require('underscore');
var bitcoin     = require("bitcoin");
var BlockChain  = require("./lib/blockchain")

function Groestlwallet() {
	var self = this;
	app.Application.apply(this, arguments);

	//http://localhost/#kozndsp2K95y8Tbb4mdpJSOJAhrxwX
	var key = "86d46f32e7ef";

	/*
	 * pendingTx = { address : [{ tx : <tx>, amount : <amount>, date : <date> }] }
	 *
	 */
	self.pendingTx = { };

	self.init(function(cb) {

		self.grsClient = new bitcoin.Client(self.config.grsqt);

		//self.blockchain = new BlockChain(self);
		//self.blockchain.start( );

		self.getTicker();

		cb();
	})




	self.on('init::express', function() {

		var cors = require('cors');
		self.app.use(cors());

		/*
		 * Index Page
		 */
		self.app.get('/', function(req, res, next){
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			var page = 'index.ejs';

			res.render( page );
		})

		/*
		 * Send tx to grs client qt.
		 * also update balance for both sender and reciever through web socket
		 */
		self.app.post('/pushtx', function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			var hexData = req.body.tx;
			var srcAddress = req.body.address
			var dest 	= req.body.dest

			self.grsClient.sendRawTransaction(hexData, function(err, resp) {

				console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx")
				console.log("error ", err)
				console.log("resp", resp)
				console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx")

				if( err ) {
					return res.json( { error : err } );
				} else {

					/*setTimeout( function() {
						self.updateBalance(srcAddress);
						self.updateBalance(dest);
					}, 15000);
					*/

					return res.json( { tx : resp } );
				}

			})

		})


		/*
		 * Get the address balance through chainz API
		 *
		 */
		self.app.get('/getBalance/:address', function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			var address =    req.params.address;

			https.get('https://chainz.cryptoid.info/grs/api.dws?q=getbalance&key=' + key + '&a=' + address, function(response) {
			  	var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });
		        response.on('end', function() {

		        	try {

		        		res.json({ balance : parseFloat(body) * 1e8 });

		        	} catch ( err ) {

		        		console.log(err);
		        		res.json({ balance : 0 });

		        	}


		        });
			})

		})

		/*
		 * Get the unconfirmed tx for the given address
		 *
		 */
		self.app.get('/unconfirmed/:address', function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			var address = req.params.address;

			res.json({ data : {
				unconfirmed : self.pendingTx[address] || []
			}});

		})


		self.app.get('/getUnspent/:address', function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			var address = req.params.address;

			var address =    req.params.address;

			https.get('https://chainz.cryptoid.info/grs/api.dws?q=multiaddr&key=' + key + '&active=' + address, function(response) {

			  	var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });

		        response.on('end', function() {

		        	body = body.substr(body.indexOf('"txs":'))
		        	body = "{" + body.substr(0, body.length-1) + "}";

		        	try {

		        		var txs = JSON.parse(body);
		        		txs = txs.txs;
		        		var isBalance = false;
		        		var tx = "";
		        		for(var i in txs) {
		        		 	if(txs[i] && txs[i].confirmations == 0) {
		        		 		isBalance = true;
		        		 		tx = txs[i].hash;
		        		 		break;
		        		 	}
		        		}
		        		return res.json( { balance: isBalance, tx : tx} );

		        	} catch ( err ) {

		        		console.log(err)
		        		return res.json( { balance: false} );

		        	}

		        });
			})

		})

		/*
		 * Get the tx info for the particular address
		 *
		 */
		self.app.get('/txs/:address', function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			var address =    req.params.address;

			https.get('https://chainz.cryptoid.info/grs/api.dws?q=multiaddr&key=' + key + '&active=' + address, function(response) {

			  	var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });

		        response.on('end', function() {

		        	body = body.substr(body.indexOf('"txs":'))
		        	body = "{" + body.substr(0, body.length-1) + "}";

		        	try {

		        		return res.json( JSON.parse(body) );

		        	} catch ( err ) {

		        		console.log(err)
					return res.json( {} );
		        	}

		        });
			})

		})

		/*
		 * Get unspent tx for the given address through chainz API
		 *
		 */
		self.app.get('/unspent/:address', function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			var address =    req.params.address;

			https.get('https://chainz.cryptoid.info/grs/api.dws?q=unspent&key=' + key + '&active=' + address, function(response) {
			  	var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });
		        response.on('end', function() {
		        	//console.log(body)
		        	try {
		        		res.json( JSON.parse(body) );
		        	} catch ( err ) {
		        		console.log(" error : /unspent/:address -> " , err);
		        		res.json( { } );
		        	}

		        });
			})

		})



		// Ticker data
		self.app.get("/ticker", function(req, res, next) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Headers", "X-Requested-With");

			res.json( self.btcpriceList );
		})



	})

	self.btcpriceList = {};

	self.getTicker = function( ) {

		http.get('http://www.groestlcoin.org/ticker2.php', function(response) {
		var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {
      		var btcpriceList = {};
      		try {

      			btcpriceList = JSON.parse(body);

      		} catch( er ) {

      			console.log(er);
      			setTimeout( self.getTicker, 1000*60*15 );
      			return;
      		}

        	https.get('https://www.groestlcoin.org/grsticker.php', function(response) {

        		var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });
		        response.on('end', function() {

		        	var price = 0;
		        	try {
		        		price = parseFloat(body);
		        	} catch ( er ) {
		        		console.log( er );
		        		setTimeout( self.getTicker, 1000*60*15 );
		        		return;
		        	}

		        	for(var i in btcpriceList) {
		        		btcpriceList[i].last = btcpriceList[i].last * price;
					delete btcpriceList[i].averages;
		        		delete btcpriceList[i].timestamp;
		        	}

		        	self.btcpriceList = btcpriceList;
		        	setTimeout( self.getTicker, 1000*60*15 );
		        });
			})

        });

    });

	}
	/*
	self.updateBalance = function(address) {

		var socketId = self.addr_sub[address];
        var socket = self.webSocketMap[socketId];

        if(socket){
        	socket.emit("message",
            {
                op      :  "balance",
                message :  "  "
            })
        }
        //console.log(address, socketId)

	}


	// websocket initialization place
	self.on('init::websockets', function() {

		self.webSocketsPublic = self.io.of('/pub-soc').on('connection', function(socket) {
            //console.log("public-websocket "+socket.id+" connected");

            self.webSocketMap[socket.id] = socket;
            socket.on('disconnect', function() {
                delete self.webSocketMap[socket.id];
                self.deleteAddSub( socket.id )
                //console.log("public-websocket " + socket.id + " disconnected");
            })

            socket.on('message', function(msg, callback) {
	            try {
	                self.emit('websocket::'+msg.op, msg, callback, socket);
	            }
	            catch( ex ) { console.error(ex.stack); }
	        });
        });
	})

	self.deleteAddSub = function( sid ) {

		for(var i in self.addr_sub) {
			if(self.addr_sub[i] == sid) {
				delete self.addr_sub[i];
				break;
			}
		}

	}

	self.addr_sub = {};

	self.on('websocket::addr_sub', function(msg, callback, socket){
		self.addr_sub[msg.addr] = socket.id;
		callback()
	})*/
}

util.inherits(Groestlwallet, app.Application);
GLOBAL.groestlwallet = new Groestlwallet(__dirname);
