# cmdmap

cmdmap is a Connect-compatible middleware that allows you to map commands on your server to API endpoints.

**WARNING:** cmdmap is just a tool, and a work in progress. Be careful while allowing arbitrary commands and parameters to run on your server!

## Usage

The essence of cmdmap is handling the mapping of POST form data (including multipart forms with files) to command line arguments. So in order to use cmdmap in any useful capacity, you will most likely need something that reads form data into `req.body` (and `req.files` for files). You will most likely use `body-parser` or `multer` for this.

### 1. Designing arguments

The possible arguments for a command are specified as an array of objects, each object representing a single argument. The objects can have the following keys:

|Key            |Description               |
|---------------|--------------------------|
|type           |Represents the "type" of this argument - can be any value from the `types` enum, documented below.|
|name           |Name of the field expected in the POST request body that contains the value for this argument. This value affects your API and is independent of the actual command being executed. Leave this field blank to form an 'invisible' argument - one which is always passed with the same default value, and which can't be changed by the API call|
|param          |Name of the flag actually passed to the command when it is executed. It should include any prefixed dashes. If this argument is left blank, the argument will be supplied as-is.|
|required       |(defaults to false) Requires this argument to be set in order for the command to execute.|
|default        |A value for the argument which is used if nothing is supplied in the POST request for this argument. In the case of 'invisible' arguments (no name field), this field is effectively mandatory, since the command will not be allowed to execute if a value isn't supplied by the POST request via the name field.|

The 'type' field takes a value from the enum `cmdmap.types`, which has the following possible values:

|Value                |Description               |
|---------------------|--------------------------|
|cmdmap.values.string      |Takes a string and passes it as the value for that argument directly|
|cmdmap.values.file        |Takes a file for upload in a multipart form, saves that file to a temporary location, and then passes the path to this temporary file as the value for this argument|
|cmdmap.values.booleanTrue |Passes the flag if the corresponding name field is present in the POST request|
|cmdmap.values.booleanFalse|Passes the flag if the corresponding name field is absent in the POST request|

A very important thing to note is that arguments are processed and passed to the command _in the order that they appear in the array._ This makes multiple arguments without a specified flag meaningful - you can control the order in which the arguments are passed and still provide a named interface via the POST field names.

For examples of some completed argument arrays, see the example below.

### 2. Using the middleware

`cmdmap.command(cmd, args[, sep])` returns a middleware that will execute your command and return a JSON object.

Arguments:

* `cmd`: The name of the command to be executed. This should be present on the PATH of the server at the time it was run.
* `args`: The array of arguments formed as above.
* `sep`: (optional, default `' '`) The separator used between the argument flags and values. For example, in `if=/dev/zero`, the separator is `'='`, and in `-c 4`, the separator is `' '`.

The JSON object returned contains the following fields:

* `status`: Either 'ok' or 'err'. Note that this denotes the success/failure of cmdmap itself, not the command executed.

* If status is 'err':
    * `error`: Details of the error

* If status is 'ok':
    * `stdout`: Everything output by the command to stdout
    * `stderr`: Everything output by the command to stderr
    * `code`: The final exit code returned by the program

## Example

    const cmdmap = require('cmdmap');
    const express = require('express');
    const multer = require('multer');

    const app = express();
    const upload = multer({ dest: '/tmp' });

    app.post('/date', cmdmap.command('date'));

    const pingArgs = [
        {
            type: cmdmap.types.string,
            name: 'count',
            param: '-c',
            required: true,
            default: '1'
        },
        {
            type: cmdmap.types.string,
            name: 'hostname',
            required: true
        }
    ];

    app.post('/ping', cmdmap.command('ping', pingArgs));

    const md5args = [
        {
            type: cmdmap.types.booleanTrue,
            name: 'binary',
            param: '-b'
        },
        {
            type: cmdmap.types.file,
            name: 'checksumFile',
            required: true
        }
    ]

    app.post('/md5sum',
        upload.single('checksumFile'),
        cmdmap.command('md5sum', md5args)
    );

    const ddParams = [
        {
            type: cmdmap.types.string,
            param: 'if',
            default: '/dev/urandom'
        },
        {
            type: cmdmap.types.string,
            param: 'bs',
            default: '8'
        },
        {
            type: cmdmap.types.string,
            param: 'count',
            name: 'chunks',
            default: '1'
        }
    ];

    app.post('/random', upload.none(), cmdmap.command('dd', ddParams, '='));

    app.listen(8000, () => console.log('Server listening at port 8000'));

After starting server:

    $ curl -X POST http://localhost:8000/date                             
    {"status":"ok","stdout":"Sun 30 Aug 2020 04:45:55 PM EDT\n","stderr":"","code":0}

    $ curl -F checksumFile=@test.c http://localhost:8000/md5sum
    {"status":"ok","stdout":"d4a1143db003033d1cf93a13bf282d9e  /tmp/347db7f38e1f97a46a9d528abd558e8d\n","stderr":"","code":0}

    $ curl -F hostname=invalidHost http://localhost:8000/ping
    {"status":"ok","stdout":"","stderr":"ping: invalidHost: Temporary failure in name resolution\n","code":2}

    $ curl -F hostname=1.1.1.1 http://localhost:8000/ping
    {"status":"ok","stdout":"PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.\n64 bytes from 1.1.1.1: icmp_seq=1 ttl=58 time=18.5 ms\n\n--- 1.1.1.1 ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss, time 0ms\nrtt min/avg/max/mdev = 18.463/18.463/18.463/0.000 ms\n","stderr":"","code":0}
    
    $ curl -F "chunks=42" http://localhost:8000/random 
    {"status":"ok","stdout":"�\u0013�߭��})�6%�*&�6\fR�j�&ɷ �\u001c�@S�T���SDH�KcN�0Qp%�i�̿�)��I�-�1�\u000eM墺�DCO@�=q��\u0017��Uk�c��\u0015���?j�z�\u001e�$��Z� qe)\u0011�,g�d�����\u001eJvZ&\u0010�fq��i�\u001f�H\u0010{n���#�[�Ӳ\u0003� G�r\b�<�aۗ-cU}�Q��~j���$�i����ܗ��W\u000e�����X��PK��K��z�ԉv%\rH��\nz��vM`F.�\u0017��ʟ�\u0011�\u0000�\t��R�NhAk��<�o�W�,ge}����C\\w����\u000f �X��\u0005s\u0006\n_��\r�<Fxm\u0014�7������WQ�.�w�5@�\u001b�~O�̰�\u0004P\u0002\u001d�pV!��O���.mP��\u000fN�\r","stderr":"42+0 records in\n42+0 records out\n336 bytes copied, 0.000472747 s, 711 kB/s\n","code":0}


# License

Code is provided under MIT license; see LICENSE.md.
