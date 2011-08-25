var nj = require('nodejitsu-client')

var client = nj.createClient({
      username: 'wizard',
      password: 'password',
      remoteUri: 'http://localhost:9001'
    })

client.apps.view('magicword', console.log)