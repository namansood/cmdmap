const childProcess = require('child_process');
const fs = require('fs');

// enums
const paramTypes = Object.freeze({
    booleanTrue: {},
    booleanFalse: {},
    string: {},
    file: {}
});

const returnTypes = Object.freeze({
    sendJSON: {},
    exposeStdio: {}
});

function createBooleanArg(pObj) {
    return pObj.param;
}

function createStringArg(pObj, value, sep) {
    if(pObj.param) return pObj.param + sep + value;
    else return value;
}

const command = function(opts) {
    let { cmd, params, seperator, returnType } = opts;
    if(!cmd) throw Error('cmdmap: did not specify command to execute!');
    if(!params) params = [];
    if(!seperator) seperator = ' ';
    if(!returnType) returnType = returnTypes.sendJSON;

    return function(req, res, next) {
        req.cmdmap = {};

        const errorState = (err) => {
            if(returnType == returnTypes.sendJSON) {
                res.status(400).send({
                    status: 'err',
                    error: err
                });
            }
            else if(returnType == returnTypes.exposeStdio) {
                next(err);
            }
        };

        const deleteTemps = (req) => {
            const files = req.file ? [ req.file ] : req.files;
            if(files) {
                for(f of files) {
                    fs.unlinkSync(f.destination + '/' + f.filename);
                }
            }
        };

        const args = [];

        let providedParams = JSON.parse(JSON.stringify(req.body || {}));
        let providedFiles = req.file ? [ req.file ] : (req.files || []);

        for(let i in params) {
            const p = params[i];
            if(!p.name) {
                if(p.default && (p.type === paramTypes.string || p.type === paramTypes.booleanTrue)) {
                    if(p.type === paramTypes.string) {
                        args.push(createStringArg(p, p.default, seperator));
                    }
                    else if(p.type === paramTypes.booleanTrue) {
                        args.push(createBooleanArg(p));
                    }
                }
                else {
                    errorState(`Misconfigured unnamed parameter ${p.param}`);
                }
            }

            else {
                if(p.type === paramTypes.string && !providedParams[p.name]) {
                    if(p.default) {
                        providedParams[p.name] = p.default;
                    }

                    else if(p.required) {
                        errorState(`Missing required parameter ${p.name}`);
                        return;
                    }

                    else {
                        continue;
                    }
                }

                switch(p.type) {
                    case paramTypes.booleanTrue:
                        if(providedParams[p.name])
                            args.push(createBooleanArg(p));
                        break;
                    case paramTypes.booleanFalse:
                        if(!providedParams[p.name])
                            args.push(createBooleanArg(p));
                        break;
                    case paramTypes.string:
                        args.push(createStringArg(p, providedParams[p.name], seperator));
                        break;
                    case paramTypes.file:
                        let file = null;
                        if(providedFiles.length > 0) {
                            file = providedFiles.shift();
                            args.push(createStringArg(p, file.destination + '/' + file.filename, seperator));
                        }
                        else if(p.required) {
                            errorState(`No file uploaded to match required param ${p.name}`);
                            return;
                        }
                        break;
                    default:
                        errorState(`Invalid property type`);
                        return;
                };
            }
        }

        const child = childProcess.spawn(cmd, args);
        
        if(returnType == returnTypes.sendJSON) {
            const resp = {
                status: 'ok',
                stdout: '',
                stderr: '',
                code: null
            };

            child.stdout.on('data', d => resp.stdout += d.toString());
            child.stderr.on('data', d => resp.stderr += d.toString());

            child.on('close', code => {
                resp.code = code;
                res.send(resp);

                deleteTemps(req);
            });
        }
        else if(returnType == returnTypes.exposeStdio) {
            req.cmdmap.stdout = child.stdout;
            req.cmdmap.stderr = child.stderr;
            req.cmdmap.stdin = child.stdin;
            req.cmdmap.waitForExit = new Promise((resolve) => {
                child.on('close', code => {
                    deleteTemps(req);
                    resolve(code);
                });
            });

            next();
        }
    };
}

module.exports = {
    types: paramTypes,
    returnTypes: returnTypes,
    command: command
};