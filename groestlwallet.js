/*
 * @author : Ashraful Sharif <sharif.ashraful@gmail.com>
 *
 */

var zapp 	= require("zetta-app");
var http  	= require("http");
var https  	= require("https");
var util 	= require("util");
var _ 		= require('underscore');
var bitcoin = require("bitcoin");
var BlockChain = require("./lib/blockchain")

function Groestlwallet() {
	var self = this;
	zapp.Application.apply(this, arguments);

	//http://localhost:4431/#kozndsp2K95y8Tbb4mdpJSOJAhrxwX
	var key = "86d46f32e7ef";

	/* 
	 * pendingTx = { hash : { address : <address>, amount : <amount>, date : <date>} }
	 *
	 */
	self.pendingTx = { };

	self.init(function(cb) {
		
		self.grsClient = new bitcoin.Client({
			host: '127.0.0.1',
			port: 1441,
			user: 'u',
			pass: 'p',
			timeout: 30000
		});

		/*grsClient.cmd('getinfo', function(err, data){
		  if (err) return console.log(err);
		  console.log('Balance:', data);
		});*/

		self.blockchain = new BlockChain(self);
		self.blockchain.start( );

		cb();
	})

	self.on('init::express', function() {	

		// Send tx to grs client
		self.app.post('/pushtx', function(req, res, next) {

			var hexData = req.body.tx;
			var address = req.body.address

			console.log( address )
			return;

			self.grsClient.sendRawTransaction(hexData, function(err, resp) {

				console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx")
				console.log("error ", err)
				console.log("resp", resp)
				console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx")

				if( err ) {
					return res.json( { error : err.toString( ) } );
				} else {
					return res.json( { tx : resp } );
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
		        	body = "{"+ body.substr(0, body.length-1) + "}";
		        	//console.log(body)
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
}

util.inherits(Groestlwallet, zapp.Application);
GLOBAL.zettaApp = new Groestlwallet(__dirname);