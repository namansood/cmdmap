const supertest = require('supertest');
const multer = require('multer');
const app = require('express')();
const cmdmap = require('../index');

const upload = multer({
    dest: '/tmp'
});

const md5params = [
    cmdmap.param({
        type: cmdmap.types.booleanTrue,
        name: 'binary',
        param: '-b',
        // required: false by default
    }),
    cmdmap.param({
        type: cmdmap.types.file,
        name: 'checksumFile',
        required: true
    })
]

app.post('/md5sum',
    upload.single('checksumFile'),
    cmdmap.command('md5sum', md5params, ' ')
);

const testPort = 4242;

app.listen(testPort, () => console.log('Test server listening on port ' + testPort));

supertest(app)
    .post('/md5sum')
    //.field('binary', 'true')
    .attach('checksumFile', __dirname + '/testfile.txt')
    .expect(200)
    .expect(res => {
        if(res.body.status !== 'ok') 
            throw new Error('status not ok');
        if(res.body.code !== 0) 
            throw new Error('command execution failed');
        if(res.body.stdout.split(' ')[0] !== 'fc3ff98e8c6a0d3087d515c0473f8677')
            throw new Error('incorrect output from command');
    })
    .end((err, res) => {
        if(err) {
            console.log('md5sum test\t[err]');
            throw err;
        }
        else {
            console.log('md5sum test\t[ok]');
        }
    });