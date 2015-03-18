'use strict';

var UTILS                       = { };
UTILS.GET_CONFIG_RETRY_INTERVAL = 3000;
UTILS.GET_CONFIG_RETRIES        = 10;
UTILS.GET_CONFIG_FILENAME       = 'remote-config.json';


var fs              = require('fs');
var os              = require('os');
var child_process   = require("child_process");
var spawn           = child_process.spawn;
var exec            = child_process.exec;
var colors          = require('colors');
var _               = require('underscore');
var hostname        = os.hostname();
GLOBAL.dpc          = function(t,fn) { if(typeof(t) == 'function') setTimeout(t,0); else setTimeout(fn,t); }



UTILS.render = function(text, font, callback) {

    if(!UTILS.art)
        UTILS.art = require('ascii-art');

    UTILS.art.font(text, '../../../fonts/cybermedium', '', function(rendered) {
        if(callback)
            return callback(null, rendered);
        else
            console.log('\n'+rendered);
    });
}

UTILS.get_ts = Date.now;

UTILS.ts_string = UTILS.tsString = function(src_date) {
    var a = src_date || (new Date());
    var year = a.getFullYear();
    var month = a.getMonth()+1; month = month < 10 ? '0' + month : month;
    var date = a.getDate(); date = date < 10 ? '0' + date : date;
    var hour = a.getHours(); hour = hour < 10 ? '0' + hour : hour;
    var min = a.getMinutes(); min = min < 10 ? '0' + min : min;
    var sec = a.getSeconds(); sec = sec < 10 ? '0' + sec : sec;
    var time = year + '-' + month + '-' + date + ' ' + hour + ':' + min + ':' + sec;
    return time;
}

/*
* read json file from the given file name
* @param {string} filename
* @return {json} json data
*/

UTILS.readJSON = function(filename) {
    if(!fs.existsSync(filename))
        return undefined;
    var text = fs.readFileSync(filename, { encoding : 'utf-8' });
    if(!text)
        return undefined;
    try { 
        return JSON.parse(text); 
    } catch(ex) { 
        console.log(ex.trace); 
        console.log('Offensing content follows:',text); 
    }
    return undefined;
}

UTILS.writeJSON = function(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data));
}


UTILS.get_config = UTILS.getConfig = function(name) {

    var host_filename = __dirname + '/../../config/'+name+'.'+hostname+'.conf';
    var filename = __dirname + '/../../config/'+name+'.conf';

    var data = undefined;

    if(fs.existsSync(host_filename)) {
        data = fs.readFileSync(host_filename);
        console.log("Reading config:",host_filename);
    }
    else
    {
        data = fs.readFileSync(filename);
        console.log("Reading config:",filename);
    }

//  console.log(data.toString('utf-8'));
    return eval('('+data.toString('utf-8')+')');
}


UTILS.get_ssl_options = function() {
    var ssl_options = {
        key : fs.readFileSync(__dirname + '/../../config/ssl/key.pem').toString(),
        cert : fs.readFileSync(__dirname + '/../../config/ssl/certificate.pem').toString(),
    }
    return ssl_options;
}


UTILS.MAX_LOG_FILE_SIZE = 50 * 1014 * 1024
UTILS.Logger = function(options) {
    var self = this;
    var file = options.filename;

    self.write = function(text) {
        try {
            fs.appendFile(file, text);
        } catch(ex) { console.log("Logger unable to append to log file:",ex); }
    }

    function log_rotation() {

        fs.stat(file, function(err, stats) {

            if(stats && stats.size > UTILS.MAX_LOG_FILE_SIZE) {

                var parts = file.split('/');
                var filename = parts.pop();
                var folder = parts.join('/');


            }
            else
                dpc(60 * 1000, log_rotation);
        })
    }

    log_rotation();
}

UTILS.Process = function(options) {
    var self = this;
    self.options = options;
    self.relaunch = true;

    if(!options.descr)
        throw new Error("descr option is required");

    self.terminate = function() {
        if(self.process) {
            self.relaunch = false;
            self.process.kill('SIGTERM');
            delete self.process;
        }
        else
            console.error("Unable to terminate process, no process present");
    }

    self.restart = function() {
        if(self.process) {
            self.process.kill('SIGTERM');
        }
    }

    self.run = function() {
        if(self.process) {
            console.error(self.options);
            throw new Error("Process is already running!");
        }

        self.relaunch = true;
        self.process = spawn(self.options.process, self.options.args, { cwd : self.options.cwd });

        if(0) {
            self.process.stdout.pipe(process.stdout);
            self.process.stderr.pipe(process.stderr);
            self.stdin = process.openStdin();
            self.stdin.pipe(self.process.stdin);
        }
        else {
            self.process.stdout.on('data',function (data) {
                process.stdout.write(data);
                if(options.logger)
                    options.logger.write(data);
            });

            self.process.stderr.on('data',function (data) {
                process.stderr.write(data);
                if(options.logger)
                    options.logger.write(data);
            });

            self.stdin = process.openStdin();
            self.stdin.on('data', function(data) {
                self.process.stdin.write(data);
            });
        }

        self.process.on('exit',function (code) {
            if(code)
                console.log("WARNING - Child process '"+self.options.descr.toUpperCase()+"' exited with code "+code);
            delete self.process;
            if(self.relaunch) {
                console.log("Restarting '"+self.options.descr.toUpperCase()+"'");
                dpc(options.restart_delay || 0, function() {
                    if(self.relaunch)
                        self.run();
                });
            }
        });
    }
}


UTILS.bytes_to_size = UTILS.bytesToSize = function(bytes, precision)
{
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    var posttxt = 0;
    if (bytes == 0) return 'n/a';
    while (bytes >= 1024)
    {
        posttxt++;
        bytes = bytes / 1024;
    }
    return bytes.toFixed(precision || 2) + sizes[posttxt];
}

// http://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js
UTILS.get_v4_ips = (function () {
    var ignoreRE = /^(127\.0\.0\.1|::1|fe80(:1)?::1(%.*)?)$/i;

    var cached;
    var command;
    var filterRE;

    switch (process.platform) {
    case 'win32':
    case 'win64':
        command = 'ipconfig';
        filterRE = /\bIPv4[^:\r\n]+:\s*([^\s]+)/g;
        break;
    case 'darwin':
        command = 'ifconfig';
        filterRE = /\binet\s+([^\s]+)/g;
        break;
    default:
        command = 'ifconfig';
        filterRE = /\binet\b[^:]+:\s*([^\s]+)/g;
        break;
    }

    return function (callback, bypassCache) {
        if (cached && !bypassCache) {
            callback(null, cached);
            return;
        }
        // system call
        exec(command, function (error, stdout, sterr) {
            cached = [];
            var ip;

            var matches = stdout.match(filterRE) || [];
            if (!error) {
                for (var i = 0; i < matches.length; i++) {
                    ip = matches[i].replace(filterRE, '$1')
                    if (!ignoreRE.test(ip)) {
                        cached.push(ip);
                    }
                }
            }
            callback(error, cached);
        });
    };
})();

UTILS.get_client_ip = UTILS.getClientIp = function(req) {
  var ipAddress;
  // Amazon EC2 / Heroku workaround to get real client IP
  var forwardedIpsStr = req.header('x-forwarded-for'); 
  if (forwardedIpsStr) {
    // 'x-forwarded-for' header may return multiple IP addresses in
    // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
    // the first one
    var forwardedIps = forwardedIpsStr.split(',');
    ipAddress = forwardedIps[0];
  }
  if (!ipAddress) {
    // Ensure getting client IP address still works in
    // development environment
    ipAddress = req.connection.remoteAddress;
  }
  return ipAddress;
};


// http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
UTILS.walk_directory = UTILS.walkDirectory = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};


UTILS.init_http_modules = function(core, root_app, module_list, module_config, callback) {

    if(!UTILS.express)
        UTILS.express = require('express');

    var modules = { }
    var module_apps = [ ]
    var module_names = [ ]
    _.each(module_list, function(name) {
        var constructor = require('../../'+name);
        var module_app = UTILS.express();
//            console.log("LOADING MODULE:",name,"WITH CONFIG:",config[name]);
        modules[name] = new constructor(core, module_config ? module_config[name] : null);
        module_names.push(name);
        // module_objects.push(module);

        module_apps.push({ name : name, root : modules[name].root, app : modules[name].app });
    })

    // sort http paths so that / goes last to prevent path interference (since everything matches /)
    module_apps.sort(function(a,b) { if(a.root == '/') return 1; return -1; })

// console.log(module_apps);

    _.each(module_apps, function(module) {
        root_app.use(module.root, module.app);
         // console.log("binding:",module.root);
    })

    init_module();

    function init_module() {
        var name = module_names.shift();
        if(!name)
            return callback();
        var module = modules[name]

        // console.log('Loading module: '+name.bold);

        module.init(function(err){
            if(err)
                console.log(err);
            init_module();
        })
    }
}

/*
* create http request and get response from the server end
* @param {object} option
*   hostname: '',
*   port: port number,
*   path: '',
*   https: false
* @param {function} callback
*/

UTILS.http_request = function(options, callback)
{    
    if(!UTILS.http)
        UTILS.http = require('http');

    if(!UTILS.https)
        UTILS.https = require('https');

    var http_handler = options.https ? UTILS.https : UTILS.http;
    var req = http_handler.request(options, function(res) {
        res.setEncoding('utf8');
        var result = '';
        res.on('data', function (data) {              
            result += data;
        });
        res.on('end', function () {
            callback(null, result);
        });
    });

    req.on('error', function(e) {
        callback(e);
    });

    if(options.post_data)    
        req.write(options.post_data);

    req.end();
}



UTILS.get_config_ex = function(options, callback) { 

    if(!options.name)
        throw new Error("missing options.name");

    if(!options.identifier)
        throw new Error("missing options.identifier");

    var config = UTILS.get_config(options.name);

    if(config.redirect) {

        var url = URL.parse(config.redirect);
        var path = url.path;
        if(path[path.length-1] != '/')
            path += '/';
        path += options.identifier;

        var opt = {
            host : url.hostname,
            port : url.port,
            path : path,
            method : 'GET',
            https : url.protocol == 'https:' ? true : false
        }

        if(options.auth)
            opt.auth = options.auth.user+':'+options.auth.pass;

        console.log("Getting config at "+url.protocol+"//"+url.hostname+":"+url.port+path);

        var retries = 0;        

        var do_request = function() {

            if(retries >= UTILS.GET_CONFIG_RETRIES) {

                if(fs.existsSync(UTILS.GET_CONFIG_FILENAME)) {
                    data = fs.readFileSync(UTILS.GET_CONFIG_FILENAME);
                    var o = eval('('+data.toString('utf-8')+')');
                    _.extend(config, o);
                }

                return callback(null, config);
            }

            UTILS.http_request(opt, function(err, text) {

                if(err) {
                    console.error(("Error getting config at "+url.protocol+"//"+url.hostname+":"+url.port+path).red.bold);
                    console.error(err.toString().red.bold);
                    retries++;
                    return dpc(UTILS.GET_CONFIG_RETRY_INTERVAL, do_request);
                }
                try {
                    var o = JSON.parse(text);
                } catch(e) {
                    console.error(e);
                    retries++;
                    return dpc(UTILS.GET_CONFIG_RETRY_INTERVAL, do_request);
                }

                fs.writeFileSync(UTILS.GET_CONFIG_FILENAME, JSON.stringify(o,null,' '));

                _.extend(config, o);
                callback(null, config);
            })
        }

        do_request();
     
    }
    else {
        callback(null, config);
    }
}

UTILS.secure_under_username = function(username) {
    if(process.platform != 'win32') {
        try {
            exec('id -u '+username, function(err, stdout, stderr) {
                if(!err) {
                    var uid = parseInt(stdout);
                    if(uid) {
                        console.log('Setting process UID to:',uid);
                        process.setuid(uid);
                    }
                }
            });
        } catch(ex) {
            console.error(ex);
        }
    }
}


UTILS.Steps = function() {
    var self = this;
    self.steps = [ ]

    self.push = function(fn) {
        self.steps.push(fn);
    }

    self.run = function(callback) {
        run_step();
        function run_step() {
            var step = self.steps.shift();
            if(!step)
                return callback();

            step.call(this, function(err) {
                if(err)
                    return callback(err);
                run_step();
            });
        }
    }
}

module.exports = UTILS;