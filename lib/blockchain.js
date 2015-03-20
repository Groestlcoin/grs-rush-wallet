/*
 * @author : Ashraful Sharif <sharif.ashraful@gmail.com>
 *
 */

var _ = require('underscore');
var autils = require('./app-utils');
var events = require('events');
var util = require('util');

function BlockChain( core ) {

    var self = this;
    events.EventEmitter.call(this);

    self.lastHeight = 0;    

    self.start = function() {

        core.grsClient.getBlockCount(function(err, currentHeight) {

            if(err) {
            
                dpc(core.config.pollingInterval, self.start);
                console.log( "Unable to get block count (client connection error)" );
                return;

            } else {

               self.processBlock( currentHeight );
    
            }
            
        })
    }


    self.processBlock = function( currentHeight ) {

        var difer = 0;
        var isFirstTime = false;

        if(!self.lastHeight) {
            difer = 1;
            isFirstTime = true;
            self.lastHeight = currentHeight;
        } else {
            difer = currentHeight - self.lastHeight;
        }

        // console.log("this.lastHeight", self.lastHeight, currentHeight)

        if( self.lastHeight == currentHeight && isFirstTime == false){
            dpc(core.config.pollingInterval, self.start);
            return false;
        }
            

        var steps = new autils.Steps( );
        for(var i = 1; i <= difer ; i++) {

            if( isFirstTime ) {

                steps.push( function( callback ) {

                    core.grsClient.getBlockHash(self.lastHeight, function (err, hash) {

                        if( err ) {
                            return callback(err);

                        } else {

                            return callback ();

                        }
                    })

                });

                break;
            } else {

                ( function( ) {

                        steps.push( function( callback ) {

                            core.grsClient.getBlockHash(self.lastHeight++, function (err, hash) {

                                if( err ) {

                                    return callback( err );

                                } else {

                                    self.fetchTxListFromBlock(hash, callback);
                                    
                                }
                            })

                        });

                })( )             

            }
        }


        steps.run(function( err ) {

            if( err ) {
                self.lastHeight--;
                console.log( err );
            }

            dpc(core.config.pollingInterval, self.start);
        })

    }

    /*
     * Get the tx list from the given block through grs RPC client
     * @param {string} blockhash hash for block
     * @param {function} callback A callback function
     */
    self.fetchTxListFromBlock = function( blockhash, callback ) {

        core.grsClient.getBlock(blockhash, function(err, block) {

            if( err ) {                
                return callback(err);

            } else {
                self.getRawTx(block.tx, callback);
            }


        })
    }


    self.getRawTx = function( txIds, callback) {

        var steps = new autils.Steps();

        for(var i in txIds) {

            (function( txid ) {

                steps.push(

                    function(cb) {

                        core.grsClient.getRawTransaction(txid, function(err, hexaData) {

                            if( err ) {                

                                return cb(err);

                            } else {

                                self.decodeRawTx(hexaData, cb);
                            }

                        })

                    }
                );

            })(txIds[i]);

        }

        steps.run(function( err ) {

            if( err ) {
                return callback(err);
            }

            return callback();
        })
      
    }

    self.decodeRawTx = function( hexData, callback) {

        core.grsClient.decodeRawTransaction(hexData, function(err, block) {
            if( err ) {
                return callback( err );
            }

            // Vout
            var vout = block.vout;
            for(var i in vout) {

                var address = vout[i].scriptPubKey.addresses[0];

                (function(address) {

                    //console.log("address", address)

                    if( core.addr_sub[address] ) {

                        var socketId = core.addr_sub[address];
                        var socket = core.webSocketMap[socketId];
                        socket.emit("message", 
                        {
                            op      :  "balance",
                            message :  "  "
                        })  


                        // When Sender balance is zero after sending the coin
                        if(vout.length == 1) {

                            var tx = block.txid;
                            var ptxs =  core.pendingTx;
                            var _address = null;
                            //console.log("tx..", tx)
                            for( var t in ptxs ) {

                                _address = t;
                                //console.log("_address..", _address)
                                var txs = ptxs[t];
                                //console.log("txs..", txs)
                                var found = false;
                                for(var k in txs) {
                                    if(txs[k].tx == tx) {
                                        found = true;
                                        break;
                                    }
                                }

                                if(found) {
                                    socketId = core.addr_sub[_address];
                                    socket = core.webSocketMap[socketId];
                                    socket.emit("message", 
                                    {
                                        op      :  "balance",
                                        message :  "  "
                                    })  
                                    break;
                                }
                            }

                        }                  
                    }

                })( address )
              
            }

            return callback();
        })
    }

    self.storePendingTx = function( data, callback ) {

        core.grsClient.decodeRawTransaction(data.hexData, function(err, block) {

            if( err ) {
                return callback( err );
            }

            // Vout
            var vout = block.vout;

            for(var i in vout) {

                var address = vout[i].scriptPubKey.addresses[0];

                if(data.address != address) {

                    if(!core.pendingTx[data.address]) {
                        core.pendingTx[data.address] = [];
                    }

                    core.pendingTx[data.address].push({

                        tx : data.tx,
                        amount : -vout[i].value,
                        confirmations : 0,
                        time_utc : (new Date()).getTime()

                    });
                }

            }

            return callback( );

        })
    }

}

util.inherits(BlockChain, events.EventEmitter);

module.exports = BlockChain;