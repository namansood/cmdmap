# cmdmap

cmdmap is a Connect-compatible middleware that allows you to map commands on your server to API endpoints.

**WARNING:** cmdmap is currently a work in progress. Be careful while allowing arbitrary commands and parameters to run on your server!

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

    $ curl -F hostname=1.1.1.1 http://localhost:4242/ping
    {"status":"ok","stdout":"PING 1.1.1.1 (1.1.1.1) 56(84) bytes of data.\n64 bytes from 1.1.1.1: icmp_seq=1 ttl=58 time=18.5 ms\n\n--- 1.1.1.1 ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss, time 0ms\nrtt min/avg/max/mdev = 18.463/18.463/18.463/0.000 ms\n","stderr":"","code":0}

# License

Code is provided under MIT license; see LICENSE.md.
