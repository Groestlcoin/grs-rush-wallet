/*
 * @author : Ashraful Sharif <sharif.ashraful@gmail.com>
 *
 */

var _ = require('underscore');
var zutils = require('zetta-utils');
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

        console.log("this.lastHeight", self.lastHeight, currentHeight)

        if( self.lastHeight == currentHeight && isFirstTime == false){
            dpc(core.config.pollingInterval, self.start);
            return false;
        }
            

        var steps = new zutils.Steps( );
        for(var i = 1; i <= difer ; i++) {

            if( isFirstTime ) {

                steps.push( function( callback ) {

                    core.grsClient.getBlockHash(self.lastHeight, function (err, hash) {

                        if( err ) {
                            return callback(err);

                        } else {

                            callback ();
                            
                        }
                    })

                });

                break;
            } else {

                ( function( ) {

                        steps.push( function( callback ) {

                            core.grsClient.getBlockHash(self.lastHeight++, function (err, hash) {

                                if( err ) {
                                    self.lastHeight--;
                                    return callback(err);

                                } else {

                                    console.log(hash)
                                    self.fetchTxListFromBlock(hash, callback);
                                }
                            })

                        });

                })( )             

            }
        }


        steps.run(function( err ) {

            if( err ) {
                console.log(err);
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
                self.lastHeight--;
                return callback(err);

            } else {
                console.log(block.tx)
                callback();
            }


        })
    }

}

util.inherits(BlockChain, events.EventEmitter);

module.exports = BlockChain;