var restify = require('restify');
var builder = require('botbuilder');
var nconf = require('nconf');
var request_support = require('request');
var request = require('request-promise').defaults({ encoding: null });
var apiai = require('apiai');
var uuidv1 = require('uuid/v1');
var azure = require('azure-storage');
var uuid = require('node-uuid');
var _ = require('lodash');
var moment = require('moment');
var entityGen = azure.TableUtilities.entityGenerator;
var sessionId = uuidv1();
var app = apiai("18301ee135374793b69033f4ca755575");

var staticResponses = require('./assests/responses.json');

// Azure Table Explorer
nconf.env().file({ file: 'config.json', search: true});
var tableName = nconf.get("TABLE_NAME");
var accountName = nconf.get("STORAGE_NAME");
var accountKey = nconf.get("STORAGE_KEY");
var partitionKey = nconf.get("PARTITION_KEY");

var registerAzureTable = require('./models/registerAzureTable');
var tableData = require('./controllers/responseData');
var OCChannelService = require('./controllers/OCChannelService');

var azureTable = new registerAzureTable(azure.createTableService(accountName, accountKey), tableName, partitionKey);

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
var bot = new builder.UniversalBot(connector);

//On Connection
bot.on('conversationUpdate', function(message){
    var initalMessage = "Hi "+ message.user.name + "! My name is Oly. I’m the official bot of the Olympic Channel and currently I'm in beta v0.2."
    bot.send(new builder.Message()
            .address(message.address)
            .text(initalMessage));
});

//Root dialog
bot.dialog('/',function(session) {
    if(hasImageAttachment(session)) {
        session.send("Thank you for sharing this attachment. What would you like to know about this?")
    } else {
        getIntentFromAPIAI(session.message.text,function(response){
            console.log(response.result.parameters["countries"]);
            var intent = response.result.metadata.intentName ;
            var username = session.message.user.name;
            var arguments = {};
            if(intent === "cmd_custom_country") {
                var messageIntent = response.result.parameters["countries"];
                if(messageIntent) {
                    arguments["country"] = messageIntent;
                    session.beginDialog('searchOcCountries',arguments);
                } else {
                    session.send("Which country are you looking for? You can just type the name of the country and I'll search my knowledge base. I also accept Olympic country codes like IND for India.");
                    session.endDialog();
                }
                //session.beginDialog('send_share_button',arguments)
            } 
            else if(intent === "cmd_custom_countryNews") {
                var messageIntent = response.result.parameters["countries"];
                arguments["country"] = messageIntent;
                bot.beginDialog('searchNewsByCountries',arguments)
            } 
            else if(intent === "cmd_custom_searchNews") {
                session.send("What would you like to know about?");
            } 
            else if(intent === "st_general_welcomeGreeting") {
                var replyText = "Hello "+username+" Nice to meet you 😊";
                session.send(replyText)
            } 
            else if(intent === "cmd_general_about") {
                var replyText = "The Olympic Channel is an internet television service operated by the International Olympic Committee. It was launched on August 21, 2016, alongside the closing of the 2016 Rio Summer Olympic Games. \n\n\n\n\n The Olympic Channel Facebook Page bot, of which you're interacting with now, was designed to help you navigate the Olympic Channel content, original programming, athletes, countries, and news."
                session.send(replyText);
            }
            else if(intent === "cmd_general_commands") {
                var arguments = {"name":username}
                console.log("Intent is",intent)
                session.beginDialog("shareBotCommand")
            }
            else if(intent === "cmd_general_help") {
               session.beginDialog('help');
            }
            else if(intent === "cmd_general_menu") {
                var arguments = {"intent":intent}
                console.log("Intent is",intent)
                session.beginDialog('menu',arguments);
            }
            else if(intent === "cmd_custom_viewEvents") {
                session.beginDialog('viewEvent');
            }
            else {
                var QA_JSON = staticResponses;
                var item = _.find(QA_JSON, {"id":intent});
                console.log("Item is", item, "Intent is", intent);
                if(item) {
                    var replyText = item["Answer"];
                    session.send(replyText);
                } else {
                    
                }
            }
        });
    }
});

bot.dialog('searchOcCountries', function(session, args, next) {
    console.log("Argument", args, args.country);
    var messageIntent = (args.country).toLowerCase();
    var data = new tableData(azureTable);
    data.getData(function(error, items) {
        var finalObj  = {};
        for(var i=0;i<items.length;i++) {
            if(messageIntent.length > 3 && (items[i]["Country"]["_"]).toLowerCase() == messageIntent) {
                finalObj["item"] = items[i];
                break;
            } else if(messageIntent.length <= 3 && (items[i]["countrycodes"]["_"]).toLowerCase() == messageIntent) {
                finalObj["item"] = items[i];
                break;
            } else {
                continue;
            }
        }
        console.log("finalObj is ",finalObj);                
        var card = createCard(session,finalObj);
        var msg = new builder.Message(session).addAttachment(card);
        session.send(msg);
        session.endDialog();
    });
});

bot.dialog('searchNewsByCountries', function(session,args,next){
        var messageIntent = (args.country).toLowerCase();
        var data = new tableData(azureTable);
        data.getData(function(error, items){
                var finalObj = {};
            for(var i=0;i<items.length;i++) {
                if(messageIntent.length > 3 && (items[i]["Country"]["_"]).toLowerCase() == messageIntent) {
                    finalObj["item"] = items[i];
                    break;
                } else if(messageIntent.length <= 3 && (items[i]["countrycodes"]["_"]).toLowerCase() == messageIntent) {
                    finalObj["item"] = items[i];
                    break;
                } else {
                    continue;
                }
            }
            console.log("finalObj is ",finalObj);                
            var card = createCard(session,finalObj);
            var msg = new builder.Message(session).addAttachment(card);
            session.send(msg);
            session.endDialog();     
        })
});

bot.dialog("shareBotCommand", function(session){
     var msg = new builder.Message(session)
    .text("Alright here are a few commands!")
    .suggestedActions(
    builder.SuggestedActions.create(
        session, [
            builder.CardAction.imBack(session, "help", "Help"),
            builder.CardAction.imBack(session, "menu", "Menu"),
            builder.CardAction.imBack(session, "search athlete", "Search Athlete"),
            builder.CardAction.imBack(session, "search Country", "Search Sport"),
            builder.CardAction.imBack(session, "search sport", "Search Sport"),
            builder.CardAction.imBack(session, "programs", "Programs"),
            builder.CardAction.imBack(session, "upcoming events", "View Events"),
        ]
    ));
    session.send(msg);
    session.endDialog();
})

bot.dialog("help", function(session){
    var replyText = "Hi, sorry if you seem to be having trouble. Below are a few options that may help you find what you need.";
    var msg = new builder.Message(session)
    .text(replyText)
    .suggestedActions(
    builder.SuggestedActions.create(
        session, [
            builder.CardAction.imBack(session, "menu", "Menu"),
            builder.CardAction.imBack(session, "bot command", "Bot Command"),
            builder.CardAction.imBack(session, "about", "About")
        ]
    ));
    session.send(msg);
    session.endDialog();
})

bot.dialog("menu", function(session,args){
    var intent = args.intent;
    var QA_JSON = staticResponses;
    var item = _.find(QA_JSON, {"id":intent});
    console.log("Item is", item, "Intent is", intent);
    var data = item["Cards"];
    var heroCardsCollection = getCardsAttachments(session,data);
    var reply = new builder.Message(session).attachmentLayout(builder.AttachmentLayout.carousel)
    .attachments(heroCardsCollection);
    session.send(reply);
    session.endDialog();
});

bot.dialog("viewEvent", function(session){
    var ocChannelService = new OCChannelService();
    console.log("OCChannelService",ocChannelService);
    ocChannelService.getTimeStampData(function(data){
        var dateBoundary = _.find(data, {"active":true});
        console.log("Date Boundary is", dateBoundary, "First Active", dateBoundary[0])
        var activeMonth = dateBoundary[0] || dateBoundary;
        var start_date = activeMonth.boundaries.start_date;
        var end_date = activeMonth.boundaries.end_date;
        ocChannelService.getEventData(start_date, end_date, function(events){
            console.log("Normal loop")
            var upcomingEvents = events["upcoming"];           
            if(upcomingEvents.length>0) {
                console.log("It Comes Inside", typeof upcomingEvents);
                var eventCards = getEventAttachment(session, upcomingEvents);
                var reply = new builder.Message(session).attachmentLayout(builder.AttachmentLayout.carousel)
                .attachments(eventCards);
                session.send(reply);
                session.endDialog();
            } else {
                var replyText = "Unable to get upcoming events. I'll make a note of it however. In the meantime, here are a couple of options for you.";
                var msg = new builder.Message(session)
                .text(replyText)
                .suggestedActions(
                builder.SuggestedActions.create(
                    session, [
                        builder.CardAction.imBack(session, "menu", "Menu"),
                        builder.CardAction.imBack(session, "bot command", "Bot Command"),
                    ]
                ));
                session.send(msg);
                session.endDialog();
            }
        });
    });
});

function hasImageAttachment(session) {
    return session.message.attachments.length > 0 &&
    session.message.attachments[0].contentType.indexOf('image') !== -1;
};

function getIntentFromAPIAI(message,callback) {
    var request = app.textRequest(message, {
        sessionId: sessionId
    });

    request.on('response', function(response) {
        console.log("response came")
        callback(response);
    });

    request.on('error', function(error) {
        console.log(error);
    });

    request.end();
}

function createCard(session, finalObj) {
    return new builder.ThumbnailCard(session)
        .title(finalObj["item"]["Country"]["_"])
        .subtitle(finalObj["item"]["countrycodes"]["_"])
        .text(finalObj["item"]["Text"]["_"])
        .images([
            builder.CardImage.create(session, finalObj["item"]["Image"]["_"])
        ])
        .buttons([
            builder.CardAction.openUrl(session, finalObj["item"]["Url"]["_"], 'More Info')
        ]);
}

function getCardsAttachments(session,items) {
    var cards = [];
    var msg = "";
    for(var i=0;i<items.length;i++) {
        var actionButtons = [];
        var btn = "";
        meg = "";
        for(var j=0;j<items[i].Buttons.length;j++) {
            btn = "";
            var btn = new builder.CardAction(session).type(items[i]["Buttons"][j]["Type"]).value(items[i]["Buttons"][j]["Value"]).title(items[i]["Buttons"][j]["Title"])
            actionButtons.push(btn);
        }
        msg = new builder.HeroCard(session)
        .title(items[i]["Title"])
        .subtitle(items[i]["Subtitle"])
        .images([
            builder.CardImage.create(session, items[i]["Image"])
        ])
        .buttons(actionButtons)
        cards.push(msg);
    }
    return cards;
};

function getEventAttachment(session, items) {
    var cards = [];
    var msg = "";
    var url = "https://www.olympicchannel.com";
    for(var i=0;i<items.length;i++) {
        msg = "";
        var start_date = moment(items[i]["start_date"]).format('DD');
        var end_date = moment(items[i]["end_date"]).format('DD');
        var eventMonth = moment(items[i]["end_date"]).format('MMM');
        var eventYear = moment(items[i]["end_date"]).format('YYYY');
        var subtitle_date = start_date + " - " + end_date + " " + eventMonth +", "+ eventYear;
        var viewOnlineUrl = url + items[i]["end_point_url"];
        console.log("URL", items[i].images.main.url);
        msg = new builder.HeroCard(session)
            .title(items[i]["title"])
            .subtitle(subtitle_date)
            .images([
                builder.CardImage.create(session, items[i].images.main.url)
            ])
            .buttons([
                builder.CardAction.openUrl(session, viewOnlineUrl, 'View Online'),
                {
                    type:"element_share",
                    value: "share",
                    title: "Share"
                }
            ]);
        cards.push(msg);   
    }
    return cards;
}