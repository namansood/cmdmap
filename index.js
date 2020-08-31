const childProcess = require('child_process');
const fs = require('fs');

// enum
const paramTypes = Object.freeze({
    booleanTrue: {},
    booleanFalse: {},
    string: {},
    file: {}
});

function createBooleanArg(pObj) {
    return pObj.param;
}

function createStringArg(pObj, value, sep) {
    if(pObj.param) return pObj.param + sep + value;
    else return value;
}

const command = function(cmd, params = [], seperator = ' ') {
    const errorState = (res, err) => {
        res.status(400).send({
            status: 'err',
            error: err
        });
    };

    return function(req, res) {
        const args = [];

        let providedParams = JSON.parse(JSON.stringify(req.body || {}));
        let providedFiles = req.file ? [ req.file ] : (req.files || []);

        for(let i in params) {
            const p = params[i];
            if(!p.name) {
                if(p.default && p.type === paramTypes.string) {
                    args.push(createStringArg(p, p.default, seperator));
                }
                else {
                    errorState(res, `Misconfigured unnamed parameter ${p.param}`);
                }
            }

            else {
                if(p.type === paramTypes.string && !providedParams[p.name]) {
                    if(p.default) {
                        providedParams[p.name] = p.default;
                    }

                    else if(p.required) {
                        errorState(res, `Missing required parameter ${p.name}`);
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
                            errorState(res, `No file uploaded to match required param ${p.name}`);
                            return;
                        }
                        break;
                    default:
                        errorState(res, `Invalid property type`);
                        return;
                };
            }
        }

        const child = childProcess.spawn(cmd, args);
        
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

            const files = req.file ? [ req.file ] : req.files;
            if(files) {
                for(f of files) {
                    fs.unlinkSync(f.destination + '/' + f.filename);
                }
            }
        });
    };
}

module.exports = {
    types: paramTypes,
    command: command
};