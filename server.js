var restify = require('restify');
var builder = require('botbuilder');
var nconf = require('nconf');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.BOTFRAMEWORK_APPID,
    appPassword: process.env.BOTFRAMEWORK_APPSECRET
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());


server.get('/', restify.plugins.serveStatic({
    directory: __dirname,
    default: '/index.html'
}));

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("You said: %s", session.message.text);
});