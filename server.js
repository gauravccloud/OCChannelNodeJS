var restify = require('restify');
var builder = require('botbuilder');
var nconf = require('nconf');

var appId = nconf.get("MICROSOFT_APP_ID");
var appPassword = nconf.get("MICROSOFT_APP_PASSWORD");

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: appId,
    appPassword: appPassword
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