/*
 * @author : Ashraful Sharif <sharif.ashraful@gmail.com>
 *
 */

var app 	= require("./lib/application");
var http  	= require("http");
var https  	= require("https");
var util 	= require("util");
var _ 		= require('underscore');
var bitcoin = require("bitcoin");
var BlockChain = require("./lib/blockchain")

function Groestlwallet() {
	var self = this;
	app.Application.apply(this, arguments);

	//http://localhost:4431/#kozndsp2K95y8Tbb4mdpJSOJAhrxwX
	var key = "86d46f32e7ef";

	/* 
	 * pendingTx = { address : [{ tx : <tx>, amount : <amount>, date : <date> }] }
	 *
	 */
	self.pendingTx = { };

	self.init(function(cb) {
		
		self.grsClient = new bitcoin.Client(self.config.grsqt);

		/*grsClient.cmd('getinfo', function(err, data){
		  if (err) return console.log(err);
		  console.log('Balance:', data);
		});*/

		self.blockchain = new BlockChain(self);
		self.blockchain.start( );

		cb();
	})


	

	self.on('init::express', function() {	


		self.app.get('/', function(req, res, next){

			var page = 'index.ejs';
			
			res.render( page );
		})

		// Send tx to grs client
		self.app.post('/pushtx', function(req, res, next) {

			var hexData = req.body.tx;
			var address = req.body.address			

			self.grsClient.sendRawTransaction(hexData, function(err, resp) {

				console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx")
				console.log("error ", err)
				console.log("resp", resp)
				console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx")

				if( err ) {
					return res.json( { error : err.toString( ) } );
				} else {

					// Store Pending tx
					self.blockchain.storePendingTx({
						tx : resp,
						address : address,
						hexData : hexData
					}, function( err, resp ) {

						if(err) {
							return res.json( { error : err.toString() } );
						}

						return res.json( { tx : resp } );

					});
					
				}

			})

		})

		// get the address balance 
		self.app.get('/getBalance/:address', function(req, res, next) {

			var address =    req.params.address; 

			http.get('http://chainz.cryptoid.info/grs/api.dws?q=getbalance&key=' + key + '&a=' + address, function(response) {
			  	var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });
		        response.on('end', function() {

		        	res.json({ balance : parseFloat(body) * 1e8 });
		        });
			})

		})

		// get the unconfirmed tx  
		self.app.get('/unconfirmed/:address', function(req, res, next) {

			var address = req.params.address; 

			res.json({ data : {
				unconfirmed : self.pendingTx[address] || []
			}});

		})

		// Get the tx info for the particular address
		self.app.get('/txs/:address', function(req, res, next) {

			var address =    req.params.address; 

			http.get('http://chainz.cryptoid.info/grs/api.dws?q=multiaddr&key=' + key + '&active=' + address, function(response) {
			  	
			  	var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });

		        response.on('end', function() {

		        	body = body.substr(body.indexOf('"txs":'))
		        	body = "{" + body.substr(0, body.length-1) + "}";
		        	
		        	var txs = JSON.parse(body);
		        	var txs = txs.txs;

		        	for( var i in txs ) {

		        		var tx = txs[i];
		        		var pendingTx = self.pendingTx[address];
		        		
		        		if(pendingTx && pendingTx.length) {

		        			for(var j in pendingTx) {
		        						        				
			        			if(pendingTx[j].tx == tx.hash) {
			        				//console.log(">>>")
			        				//console.log(pendingTx[j].tx, tx.hash)
			        				pendingTx.splice(0, 1);
			        			}

			        		}


			        		if( !self.pendingTx[address].length ) {
			        			delete self.pendingTx[address];
			        		}

		        		}

		        	}

		        	res.json( JSON.parse(body) );
		        });
			})

		})

		// Get unspent tx
		self.app.get('/unspent/:address', function(req, res, next) {

			var address =    req.params.address; 

			http.get('http://chainz.cryptoid.info/grs/api.dws?q=unspent&key=' + key + '&active=' + address, function(response) {
			  	var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });
		        response.on('end', function() {
		        	//console.log(body)
		        	res.json( JSON.parse(body) );
		        });
			})

		})

		// Ticker data
		self.app.get("/ticker", function(req, res, next) {

			https.get('https://rushwallet.com/ticker2.php', function(response) {
				var body = '';
		        response.on('data', function(d) {
		            body += d;
		        });
		        response.on('end', function() {
		      		
		        	var btcpriceList = JSON.parse(body);
		        	http.get('http://www.groestlcoin.org/grsticker.php', function(response) {

		        		var body = '';
				        response.on('data', function(d) {
				            body += d;
				        });
				        response.on('end', function() {
				        	var price = parseFloat(body);
				        	for(var i in btcpriceList) {
				        		btcpriceList[i].last = btcpriceList[i].last * price;
				        		delete btcpriceList[i].ask;
				        		delete btcpriceList[i].bid;
				        		delete btcpriceList[i].volume_btc;
				        		delete btcpriceList[i].volume_percent;
				        	}
				        	res.json( btcpriceList );
				        });
					})

		        });

		    });
		})


		
	})

	//websocket initialization place
	self.on('init::websockets', function() {

		self.webSocketsPublic = self.io.of('/pub-soc').on('connection', function(socket) {
            console.log("public-websocket "+socket.id+" connected");

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
	})
}

util.inherits(Groestlwallet, app.Application);
GLOBAL.groestlwallet = new Groestlwallet(__dirname);